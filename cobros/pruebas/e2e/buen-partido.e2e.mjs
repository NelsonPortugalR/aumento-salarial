// Prueba de punta a punta del cobro de Buen Partido: sitio armado (site/), motor de cobros real (nucleo.js)
// con tienda en memoria y Mercado Pago simulado. Uso: NODE_PATH="$(npm root -g)" node cobros/pruebas/e2e/buen-partido.e2e.mjs RUTA/buen-partido/site
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { atender, limitador } = await import(new URL('../../supabase/functions/cobros/nucleo.js', import.meta.url));
const { tiendaMemoria, mercadoPagoSimulado } = await import(new URL('../memoria.mjs', import.meta.url));

const DIST = process.argv[2];
const SITE = 'https://buen-partido.netlify.app';
const COBROS = 'https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros';
let failures = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error('FALLA:', m); } };

const tienda = tiendaMemoria({ productos: [{ id: 'buen-partido-reporte', sitio: 'buen-partido', nombre: 'Reporte completo y plan de 30 días (Buen Partido)', precios: { a: 39, b: 59 }, cupones: { PATA20: 20 }, origenes: [SITE], descriptor: 'BUENPARTIDO', prefijo: 'BP' }], panelHuella: 'x' });
const MP = mercadoPagoSimulado('APP_USR-e2e');
let token = 'APP_USR-e2e';
const limites = new Map();
const llamadas = [];
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
const ctxCobro = () => ({ tienda, token, base: COBROS, fetch: MP.fetch, ahora: () => new Date(), log: () => {}, limite: (k, max) => { if (!limites.has(max)) limites.set(max, limitador(max, 600e3)); return limites.get(max)(k); } });

async function nuevo({ beta = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Lima', locale: 'es-PE' });
  await ctx.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === SITE) {
      let f = path.join(DIST, decodeURIComponent(u.pathname));
      if (f.endsWith('/')) f += 'index.html';
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'no' });
      let body = fs.readFileSync(f);
      if (!beta && f.endsWith(path.join(DIST, 'index.html'))) body = body.toString('utf8').replace('BETA_MODE: true,', 'BETA_MODE: false,');
      return route.fulfill({ status: 200, contentType: tipos[path.extname(f)] || 'application/octet-stream', body });
    }
    if (req.url().startsWith(COBROS)) {
      llamadas.push(req.method() + ' ' + u.pathname.replace(/^.*\/cobros/, '') + (u.search || '') + (req.postData() ? ' ' + req.postData() : ''));
      const r = await atender({ method: req.method(), url: u, texto: req.postData() || '', ip: '9.9.9.9', panel: '' }, ctxCobro());
      return route.fulfill({ status: r.status, headers: r.headers, body: r.body || '' });
    }
    if (u.hostname === 'unzbrfdqsjjpnokirlsk.supabase.co') return route.fulfill({ status: 201, body: '' });
    if (u.hostname === 'www.mercadopago.com.pe') {
      const n = Number(u.searchParams.get('pref_id').replace('pref-', ''));
      const pref = MP.prefs[n - 1];
      MP.pagos.push({ id: 7000 + n, external_reference: pref.external_reference, status: 'approved', currency_id: 'PEN', transaction_amount: pref.items[0].unit_price });
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(pref.back_urls.success)})</script>` });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errores.push(e.message));
  return { ctx, page };
}
async function hacerTest(page) {
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(90);
    if (await page.locator('[data-action=care-continue]').count()) { await page.click('[data-action=care-continue]'); continue; }
    const opts = page.locator('.opt');
    const n = await opts.count();
    if (!n) break;
    const q = (await page.locator('.qtext').innerText()).trim();
    const idx = /^Hoy, ¿qué quieres\?|^En las últimas dos semanas/.test(q) ? 0 : (n === 5 ? 2 : 0);
    await opts.nth(Math.min(idx, n - 1)).click();
    await page.waitForTimeout(280);
  }
}

const browser = await chromium.launch();
const errores = [];

// 1) Beta (como está hoy): el correo abre el reporte gratis y no se crea ningún pago
{
  const { ctx, page } = await nuevo({ beta: true });
  await page.goto(SITE + '/');
  await page.click('[data-action=start] >> nth=0');
  await hacerTest(page);
  await page.fill('[name=email]', 'prueba@example.com');
  await page.check('[name=privacy]');
  await page.click('[data-action=submit-capture]');
  await page.waitForSelector('#planes [data-action=open-report]', { timeout: 8000 });
  ok(!llamadas.some(l => l.includes('/crear')), 'la beta no crea pagos');
  await ctx.close();
}

// 2) Pago real con cupón: de la hoja de pago a Mercado Pago y de vuelta con el reporte abierto y su código
let codigoBP = '';
{
  const { ctx, page } = await nuevo({ beta: false });
  await page.goto(SITE + '/?precio=a');
  await page.click('[data-action=start] >> nth=0');
  await hacerTest(page);
  await page.click('[data-action=skip-capture]');
  await page.waitForSelector('#planes [data-action=checkout]', { timeout: 8000 });
  await page.click('#planes [data-action=checkout]');
  await page.waitForSelector('.sheet-body [data-action=pay]');
  await page.waitForFunction(() => document.querySelector('.sheet-body [data-action=pay]').textContent.includes('con tarjeta'));
  const hoja = await page.locator('.sheet-body').innerText();
  ok(/Mercado Pago/.test(hoja) && !/Modo demo/.test(hoja) && /código de descuento/.test(hoja), 'hoja de pago real, con cupón');
  await page.fill('[name=pay-cupon]', 'pata20');
  await page.click('[data-action=apply-cupon]');
  await page.waitForFunction(() => /31\.2/.test(document.querySelector('[data-precio]').textContent));
  ok(/S\/ 31\.2/.test(await page.textContent('[data-action=pay]')), 'el cupón baja el precio a S/ 31.20');
  await page.fill('[name=pay-email]', 'cliente@example.com');
  await page.check('[name=pay-privacy]');
  await Promise.all([page.waitForURL(/pago=|\/$/), page.click('[data-action=pay]')]);
  await page.waitForSelector('.sheet-body .code-pill', { timeout: 15000 });
  codigoBP = (await page.textContent('.sheet-body .code-pill')).trim();
  ok(/^BP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigoBP), 'pago confirmado con código: ' + codigoBP);
  const crear = llamadas.find(l => l.includes('/crear'));
  const cuerpo = JSON.parse(crear.slice(crear.indexOf('{')));
  ok(cuerpo.producto === 'buen-partido-reporte' && cuerpo.variante === 'a' && cuerpo.cupon === 'PATA20' && cuerpo.volver === SITE + '/' && !('precio' in cuerpo), 'pedido sin precio, con variante y cupón: ' + JSON.stringify(cuerpo));
  ok(MP.prefs[0].items[0].unit_price === 31.2, 'Mercado Pago cobra S/ 31.20');
  ok(!page.url().includes('pago='), 'la dirección queda limpia: ' + page.url());
  const sv = await page.evaluate(() => JSON.parse(localStorage.getItem('buenpartido:v1')));
  ok(sv.plan === 'completo' && sv.codigo === codigoBP && !(await page.evaluate(() => localStorage.getItem('buenpartido:pedido'))), 'queda el reporte pagado con su código y se olvida el pedido');
  await page.click('.sheet-body [data-action=close-sheet]');
  await page.waitForTimeout(300);
  ok(await page.locator('#report').count() === 1, 'se ve el reporte completo');
  await ctx.close();
}

// 3) Otro equipo: el código abre el reporte
{
  const { ctx, page } = await nuevo({ beta: false });
  await page.goto(SITE + '/');
  await page.click('[data-action=start] >> nth=0');
  await hacerTest(page);
  await page.click('[data-action=skip-capture]');
  await page.click('#planes [data-action=checkout]');
  await page.waitForSelector('.sheet-body details');
  await page.click('.sheet-body details summary');
  await page.fill('[name=pay-codigo]', codigoBP.toLowerCase());
  await page.click('[data-action=redeem]');
  await page.waitForSelector('#report', { timeout: 8000 });
  ok(true, 'el código abre el reporte en otro equipo');
  // El atajo #pago= de la demo ya no desbloquea
  await ctx.close();
}
{
  const { ctx, page } = await nuevo({ beta: false });
  await page.goto(SITE + '/');
  await page.click('[data-action=start] >> nth=0');
  await hacerTest(page);
  await page.click('[data-action=skip-capture]');
  await page.waitForSelector('#planes [data-action=checkout]');
  await page.goto(SITE + '/#pago=lo-que-sea');
  await page.waitForTimeout(800);
  const sv = await page.evaluate(() => JSON.parse(localStorage.getItem('buenpartido:v1')));
  ok(sv.plan === '', 'el atajo #pago= ya no desbloquea');
  await ctx.close();
}

// 4) Sin clave de Mercado Pago (y fuera de la beta): la demo simula como hoy
{
  token = '';
  const { ctx, page } = await nuevo({ beta: false });
  await page.goto(SITE + '/');
  await page.click('[data-action=start] >> nth=0');
  await hacerTest(page);
  await page.click('[data-action=skip-capture]');
  await page.click('#planes [data-action=checkout]');
  await page.waitForFunction(() => /Simular/.test(document.querySelector('.sheet-body [data-action=pay]').textContent));
  await page.fill('[name=pay-email]', 'demo@example.com');
  await page.check('[name=pay-privacy]');
  await page.click('[data-action=pay]');
  await page.waitForSelector('#report', { timeout: 8000 });
  ok(true, 'sin clave, la demo abre el reporte como antes');
  await ctx.close();
}

await browser.close();
ok(errores.length === 0, 'errores en la página: ' + errores.join(' | '));
console.log(`Buen Partido e2e: ${checks - failures}/${checks} verificaciones OK`);
if (failures) process.exit(1);
