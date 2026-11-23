// Prueba de punta a punta del cobro de Lo Tuyo: página real, motor de cobros real (nucleo.js) con tienda en
// memoria y Mercado Pago simulado. Mercado Pago se abre en otra pestaña y nada se guarda en el dispositivo.
// Uso: NODE_PATH="$(npm root -g)" node cobros/pruebas/e2e/lo-tuyo.e2e.mjs sitios/lo-tuyo/index.html
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { atender, limitador } = await import(new URL('../../supabase/functions/cobros/nucleo.js', import.meta.url));
const { tiendaMemoria, mercadoPagoSimulado } = await import(new URL('../memoria.mjs', import.meta.url));

const HTML = fs.readFileSync(process.argv[2]);
const SITE = 'https://lo-tuyo.netlify.app';
const COBROS = 'https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros';
let failures = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error('FALLA:', m); } };

const tienda = tiendaMemoria({ productos: [{ id: 'lo-tuyo-reporte', sitio: 'lo-tuyo', nombre: 'Reporte personalizado', precios: { unico: 39 }, origenes: [SITE], descriptor: 'PORTUGALRI', prefijo: 'LT' }], panelHuella: 'x' });
const MP = mercadoPagoSimulado('APP_USR-e2e');
let token = 'APP_USR-e2e';
let aprobar = true;
const limites = new Map();
const llamadas = [];
const errores = [];
const ctxCobro = () => ({ tienda, token, base: COBROS, fetch: MP.fetch, ahora: () => new Date(), log: () => {}, limite: (k, max) => { if (!limites.has(max)) limites.set(max, limitador(max, 600e3)); return limites.get(max)(k); } });

const browser = await chromium.launch();
async function nuevo() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === SITE) return u.pathname === '/' ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML }) : route.fulfill({ status: 404, body: '' });
    if (req.url().startsWith(COBROS)) {
      llamadas.push(req.method() + ' ' + u.pathname.replace(/^.*\/cobros/, '') + (req.postData() ? ' ' + req.postData() : ''));
      const r = await atender({ method: req.method(), url: u, texto: req.postData() || '', ip: '9.9.9.9', panel: '' }, ctxCobro());
      return route.fulfill({ status: r.status, headers: r.headers, body: r.body || '' });
    }
    if (u.hostname === 'unzbrfdqsjjpnokirlsk.supabase.co') return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    if (u.hostname === 'www.mercadopago.com.pe') {
      const n = Number(u.searchParams.get('pref_id').replace('pref-', ''));
      const pref = MP.prefs[n - 1];
      if (aprobar) MP.pagos.push({ id: 7000 + n, external_reference: pref.external_reference, status: 'approved', currency_id: 'PEN', transaction_amount: pref.items[0].unit_price });
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<script>setTimeout(() => location.replace(${JSON.stringify(pref.back_urls.success)}), 300)</script>` });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errores.push(e.message));
  return { ctx, page };
}
async function hacerTest(page) {
  await page.goto(SITE + '/');
  await page.click('[data-act="start"] >> nth=0');
  await page.waitForTimeout(150);
  if (await page.locator('[data-act="begin"]').count()) await page.click('[data-act="begin"]');
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(120);
    if (await page.locator('[data-act="unlock"]').count() || await page.locator('.result').count()) break;
    const opts = page.locator('.opt:not([data-v="now"])');
    if (!(await opts.count())) { const nx = page.locator('[data-act="next"]:not([disabled])'); if (await nx.count()) await nx.click(); continue; }
    const multi = await page.locator('.opt.multi').count();
    // La primera opción suele ser la situación más común; se evita "now" (riesgo ahora)
    await opts.nth(0).click();
    await page.waitForTimeout(300);
    if (multi) { const nx = page.locator('[data-act="next"]:not([disabled])'); if (await nx.count()) await nx.click(); }
  }
}
const nadaGuardado = page => page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === '');

// 1) Pago en otra pestaña: el reporte se abre en la pestaña del test, con su código, sin guardar nada
let codigoLT = '';
{
  const { ctx, page } = await nuevo();
  await hacerTest(page);
  await page.waitForSelector('[data-act="unlock"]', { timeout: 10000 });
  await page.waitForFunction(() => /Pago único con tarjeta/.test(document.querySelector('.up-buy').textContent));
  ok(true, 'con el motor activo, el reporte muestra el pago real');
  await page.click('[data-act="unlock"]');
  await page.waitForSelector('[data-act="payGo"]', { timeout: 8000 });
  const href = await page.getAttribute('[data-act="payGo"]', 'href');
  ok(href.startsWith('https://www.mercadopago.com.pe/') && await page.getAttribute('[data-act="payGo"]', 'target') === '_blank', 'el pago se abre en otra pestaña');
  const crear = JSON.parse(llamadas.find(l => l.includes('/crear')).split(' ').slice(2).join(' '));
  ok(crear.producto === 'lo-tuyo-reporte' && crear.variante === 'unico' && crear.volver === SITE + '/', 'pedido sin precio: ' + JSON.stringify(crear));
  ok(MP.prefs[0].items[0].title === 'Reporte personalizado' && MP.prefs[0].statement_descriptor === 'PORTUGALRI', 'nombre neutro en Mercado Pago');
  const [mpTab] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-act="payGo"]')]);
  mpTab.on('pageerror', e => errores.push('pestaña de regreso: ' + e.message));
  // La pestaña de regreso confirma el pago y muestra el código, sin guardar nada
  await mpTab.waitForURL(/lo-tuyo\.netlify\.app\/$/, { timeout: 10000 });
  await mpTab.waitForFunction(() => /Pago confirmado/.test(document.querySelector('h1') ? document.querySelector('h1').textContent : ''), null, { timeout: 15000 });
  const textoRegreso = await mpTab.textContent('#view');
  codigoLT = (textoRegreso.match(/LT-[A-Z0-9]{4}-[A-Z0-9]{4}/) || [''])[0];
  ok(codigoLT && /Vuelve a la pestaña/.test(textoRegreso) && !mpTab.url().includes('pago='), 'la pestaña de regreso confirma el pago, da el código y limpia la dirección');
  ok(await nadaGuardado(mpTab), 'la pestaña de regreso no guarda nada');
  // La pestaña del test se desbloquea sola
  await page.bringToFront();
  await page.waitForFunction(c => document.body.textContent.includes(c), codigoLT, { timeout: 15000 });
  ok(/Pago confirmado/.test(await page.textContent('#modal')), 'la pestaña del test confirma el pago con el mismo código');
  await page.click('[data-act="payDone"]');
  await page.waitForTimeout(400);
  ok(await page.locator('[data-act="unlock"]').count() === 0, 'reporte completo abierto en la pestaña del test');
  ok(await nadaGuardado(page), 'la pestaña del test no guarda nada en el dispositivo');
  await ctx.close();
}

// 2) Cerró la pestaña: rehace el test y abre el reporte con el código
{
  const { ctx, page } = await nuevo();
  await hacerTest(page);
  await page.waitForSelector('[data-act="unlock"]');
  await page.waitForFunction(() => /Pago único con tarjeta/.test(document.querySelector('.up-buy').textContent));
  await page.click('[data-act="unlock"]');
  await page.waitForSelector('#modal details');
  await page.click('#modal details summary');
  await page.fill('#lt-cod', codigoLT.toLowerCase());
  await page.click('[data-act="redeem"]');
  await page.waitForTimeout(600);
  ok(await page.locator('[data-act="unlock"]').count() === 0 && await page.locator('#modal .dialog').count() === 0, 'el código abre el reporte completo');
  await ctx.close();
}

// 3) Salir rápido detiene todo, incluso un pago en espera
{
  aprobar = false;
  const { ctx, page } = await nuevo();
  await hacerTest(page);
  await page.waitForSelector('[data-act="unlock"]');
  await page.waitForFunction(() => /Pago único con tarjeta/.test(document.querySelector('.up-buy').textContent));
  await page.click('[data-act="unlock"]');
  await page.waitForSelector('[data-act="payGo"]');
  const [mpTab] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-act="payGo"]')]);
  await mpTab.close();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const antes = llamadas.length;
  await page.waitForTimeout(5000).catch(() => {});
  ok(llamadas.length === antes, 'después de Salir rápido no hay más consultas al motor');
  await ctx.close();
}

// 4) Sin clave de Mercado Pago, la versión de prueba sigue igual
{
  token = '';
  const { ctx, page } = await nuevo();
  await hacerTest(page);
  await page.waitForSelector('[data-act="unlock"]');
  await page.waitForTimeout(500);
  ok(/Versión de prueba/.test(await page.textContent('.up-buy')), 'sin clave, sigue la versión de prueba');
  await page.click('[data-act="unlock"]');
  await page.waitForSelector('[data-act="confirmPay"]');
  await page.click('[data-act="confirmPay"]');
  await page.waitForTimeout(300);
  ok(await page.locator('[data-act="unlock"]').count() === 0, 'la prueba abre el reporte como antes');
  await ctx.close();
}

await browser.close();
ok(errores.length === 0, 'errores en la página: ' + errores.join(' | '));
console.log(`Lo Tuyo e2e: ${checks - failures}/${checks} verificaciones OK`);
if (failures) process.exit(1);
