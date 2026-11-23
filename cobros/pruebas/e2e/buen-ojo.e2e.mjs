// Prueba de punta a punta del cobro de Buen Ojo: sitio real (dist/), motor de cobros real (nucleo.js)
// con tienda en memoria y Mercado Pago simulado. Uso: NODE_PATH="$(npm root -g)" node cobros/pruebas/e2e/buen-ojo.e2e.mjs RUTA/buen-ojo/dist
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { atender, limitador } = await import(new URL('../../supabase/functions/cobros/nucleo.js', import.meta.url));
const { tiendaMemoria, mercadoPagoSimulado } = await import(new URL('../memoria.mjs', import.meta.url));

const DIST = process.argv[2];
const SITE = 'https://buen-ojo.netlify.app';
const COBROS = 'https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros';
let failures = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error('FALLA:', m); } };

const tienda = tiendaMemoria({ productos: [{ id: 'buen-ojo-reporte', sitio: 'buen-ojo', nombre: 'Reporte completo (Buen Ojo)', precios: { p3900: 39, p5900: 59 }, origenes: [SITE], descriptor: 'BUENOJO', prefijo: 'BO' }], panelHuella: 'x' });
const MP = mercadoPagoSimulado('APP_USR-e2e');
let token = 'APP_USR-e2e';
const limites = new Map();
const llamadas = [];
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain' };

async function rutas(ctx) {
  await ctx.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === SITE) {
      let f = path.join(DIST, decodeURIComponent(u.pathname));
      if (f.endsWith('/')) f += 'index.html';
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'no' });
      return route.fulfill({ status: 200, contentType: tipos[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (req.url().startsWith(COBROS)) {
      llamadas.push(u.pathname.replace(/^.*\/cobros/, '') + (u.search || ''));
      const r = await atender({ method: req.method(), url: u, texto: req.postData() || '', ip: '9.9.9.9', panel: '' },
        { tienda, token, base: COBROS, fetch: MP.fetch, ahora: () => new Date(), log: () => {}, limite: (k, max) => { if (!limites.has(max)) limites.set(max, limitador(max, 600e3)); return limites.get(max)(k); } });
      return route.fulfill({ status: r.status, headers: r.headers, body: r.body || '' });
    }
    if (u.hostname === 'unzbrfdqsjjpnokirlsk.supabase.co') return route.fulfill({ status: 201, body: '' });   // inserciones anónimas
    if (u.hostname === 'www.mercadopago.com.pe') {
      // Pago aprobado en Mercado Pago y regreso automático a la página
      const n = Number(u.searchParams.get('pref_id').replace('pref-', ''));
      const pref = MP.prefs[n - 1];
      MP.pagos.push({ id: 7000 + n, external_reference: pref.external_reference, status: 'approved', currency_id: 'PEN', transaction_amount: pref.items[0].unit_price });
      // Playwright no intercepta la petición a la que lleva un 302, así que el regreso se hace con una página que navega
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(pref.back_urls.success)})</script>` });
    }
    return route.abort();
  });
}

const res = { p: 'espera', sec: 'salvavidas', s: { A: 70, E: 30, W: 60, R: 50, C: 40, S: 20 }, ap: 'ansioso', si: 1, t: 'none' };
const d = Buffer.from(JSON.stringify(res)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const browser = await chromium.launch();
const errores = [];
async function nuevo(precio) {
  const ctx = await browser.newContext();
  await rutas(ctx);
  await ctx.addInitScript(p => { try { if (p) localStorage.setItem('bo_precio', JSON.stringify(p)); } catch (e) {} }, precio);
  const page = await ctx.newPage();
  page.on('pageerror', e => errores.push(e.message));
  return { ctx, page };
}

// 1) Pago real: del resultado a Mercado Pago y de vuelta al reporte desbloqueado, con código
{
  const { ctx, page } = await nuevo(39);
  await page.goto(`${SITE}/resultado/#d=${d}`);
  await page.waitForSelector('#r-pagar');
  await page.waitForFunction(() => document.getElementById('m-pagar').textContent.includes('con tarjeta'));
  ok(await page.locator('#m-demo').isHidden(), 'con el motor activo no se muestra el modo de prueba');
  await page.click('#r-pagar');
  await page.fill('#m-email', 'ana@correo.pe');
  await page.check('#m-priv');
  await Promise.all([page.waitForURL(/\/reporte\//), page.click('#m-pagar')]);
  await page.waitForSelector('#ok-titulo', { timeout: 15000 });
  const crear = JSON.parse(MP.prefs[0] ? JSON.stringify({ monto: MP.prefs[0].items[0].unit_price, vuelta: MP.prefs[0].back_urls.success }) : '{}');
  ok(crear.monto === 39 && crear.vuelta.startsWith(`${SITE}/reporte/?d=`) && crear.vuelta.includes('&pago='), 'pedido por S/ 39 que vuelve al reporte: ' + JSON.stringify(crear));
  const codigo = (await page.textContent('.pago__precio')).trim();
  ok(/^BO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo), 'muestra el código de acceso: ' + codigo);
  ok(await page.locator('#rp-pdf').count() === 1 && !(await page.url()).includes('pago='), 'reporte desbloqueado y dirección limpia: ' + page.url());
  const unlock = await page.evaluate(() => JSON.parse(localStorage.getItem('bo_unlock')));
  ok(unlock && unlock.ref === codigo, 'el desbloqueo guarda el código');
  // 2) Otro dispositivo: el reporte bloqueado se abre con el código
  const otro = await nuevo(39);
  await otro.page.goto(`${SITE}/reporte/#d=${d}`);
  await otro.page.waitForSelector('#rp-codigo');
  await otro.page.fill('#rp-cod', codigo.toLowerCase());
  await otro.page.click('#rp-codigo button');
  await otro.page.waitForSelector('#rp-pdf');
  ok(true, 'el código abre el reporte en otro dispositivo');
  // 3) El enlace del reporte lleva el código y se valida en el motor
  const otro2 = await nuevo(39);
  await otro2.page.goto(`${SITE}/reporte/#d=${d}&k=${encodeURIComponent(codigo)}`);
  await otro2.page.waitForSelector('#rp-pdf');
  ok(true, 'el enlace con código abre el reporte');
  await ctx.close(); await otro.ctx.close(); await otro2.ctx.close();
}

// 4) Ya no basta con escribir ?pago=ok ni un código inventado
{
  const { ctx, page } = await nuevo(39);
  await page.goto(`${SITE}/reporte/?d=${d}&pago=ok&status=approved&collection_status=approved#k=BO-AAAA-BBBB`);
  await page.waitForSelector('#rp-codigo');
  await page.waitForTimeout(600);
  ok(await page.locator('#rp-pdf').count() === 0, 'la dirección sola no desbloquea el reporte');
  await ctx.close();
}

// 5) Pago rechazado: no desbloquea y lo explica
{
  const { ctx, page } = await nuevo(59);
  const r = await atender({ method: 'POST', url: new URL(COBROS + '/crear'), texto: JSON.stringify({ producto: 'buen-ojo-reporte', variante: 'p5900', volver: `${SITE}/reporte/?d=${d}` }), ip: '8.8.8.8', panel: '' },
    { tienda, token, base: COBROS, fetch: MP.fetch, ahora: () => new Date(), log: () => {}, limite: () => true });
  const ped = JSON.parse(r.body).pedido;
  MP.pagos.push({ id: 8888, external_reference: ped, status: 'rejected', currency_id: 'PEN', transaction_amount: 59 });
  await page.goto(`${SITE}/reporte/?d=${d}&pago=${ped}`);
  await page.waitForSelector('.aviso--error', { timeout: 10000 });
  ok(/no se completó/.test(await page.textContent('.aviso--error')) && await page.locator('#rp-pdf').count() === 0, 'pago rechazado: no desbloquea y lo dice');
  await ctx.close();
}

// 6) Sin clave de Mercado Pago, sigue el modo de prueba de hoy
{
  token = '';
  const { ctx, page } = await nuevo(39);
  await page.goto(`${SITE}/resultado/#d=${d}`);
  await page.waitForSelector('#r-pagar');
  await page.waitForTimeout(400);
  ok((await page.textContent('#m-pagar')).includes('Simular'), 'sin clave el botón sigue simulando');
  await page.click('#r-pagar');
  await page.fill('#m-email', 'ana@correo.pe');
  await page.check('#m-priv');
  await Promise.all([page.waitForURL(/\/reporte\//), page.click('#m-pagar')]);
  await page.waitForSelector('#rp-pdf');
  ok(true, 'el modo de prueba abre el reporte como antes');
  await ctx.close();
}

await browser.close();
ok(errores.length === 0, 'errores en la página: ' + errores.join(' | '));
console.log(`Buen Ojo e2e: ${checks - failures}/${checks} verificaciones OK`);
if (failures) process.exit(1);
