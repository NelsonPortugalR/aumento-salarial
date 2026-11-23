// Libro de Reclamaciones de Lo Tuyo, Buen Partido y Buen Ojo, de punta a punta en Chromium: la hoja llega al
// motor de cobros real (nucleo.js, tienda en memoria) y la persona recibe su constancia con número.
// Uso: NODE_PATH="$(npm root -g)" node cobros/pruebas/e2e/libro.e2e.mjs sitios/lo-tuyo/index.html RUTA/buen-partido/site RUTA/buen-ojo/dist
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { atender, limitador } = await import(new URL('../../supabase/functions/cobros/nucleo.js', import.meta.url));
const { tiendaMemoria } = await import(new URL('../memoria.mjs', import.meta.url));

const [LT, BP, BO] = process.argv.slice(2);
const COBROS = 'https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros';
let failures = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error('FALLA:', m); } };
const tienda = tiendaMemoria({ productos: [], panelHuella: 'x' });
const limites = new Map();
const errores = [];
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const anio = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 4);

const browser = await chromium.launch();
async function abrir(origen, servir, ruta) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === origen) {
      const f = servir(u.pathname);
      if (!f || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: tipos[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (req.url().startsWith(COBROS)) {
      const r = await atender({ method: req.method(), url: u, texto: req.postData() || '', ip: origen, panel: '' },
        { tienda, token: '', base: COBROS, fetch: async () => { throw new Error('sin red'); }, ahora: () => new Date(), log: () => {},
          limite: (k, max) => { if (!limites.has(max)) limites.set(max, limitador(max, 600e3)); return limites.get(max)(k); } });
      return route.fulfill({ status: r.status, headers: r.headers, body: r.body || '' });
    }
    if (u.hostname === 'unzbrfdqsjjpnokirlsk.supabase.co') return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errores.push(origen + ': ' + e.message));
  await page.goto(origen + ruta);
  return { ctx, page };
}
async function llenarYEnviar(page, sitio) {
  await page.waitForSelector('.lr form', { timeout: 8000 });
  ok(/Libro de Reclamaciones virtual/.test(await page.textContent('.lr')) && /Portugal Research International/.test(await page.textContent('.lr')), sitio + ': libro con el proveedor');
  await page.click('.lr .lr-boton');
  ok(/Falta completar/.test(await page.textContent('.lr-err')), sitio + ': avisa qué falta');
  await page.fill('[name=nombre]', 'Ana Pérez Quispe');
  await page.fill('[name=documento]', '45678912');
  await page.fill('[name=domicilio]', 'Jr. Las Flores 123, Arequipa');
  await page.fill('[name=email]', 'ana@correo.pe');
  await page.check('[name=tipo][value=queja]');
  await page.fill('[name=detalle]', 'Esperé respuesta varios días.');
  await page.fill('[name=pedido]', 'Que me respondan.');
  await page.click('.lr .lr-boton');
  await page.waitForSelector('.lr-num', { timeout: 8000 });
  const num = (await page.textContent('.lr-num')).trim();
  const txt = await page.textContent('.lr');
  ok(num === `000001-${anio}` && /Queja/.test(txt) && /Ana Pérez Quispe/.test(txt), sitio + ': constancia con número y datos: ' + num);
  const hoja = tienda.db.reclamos.find(r => r.sitio === sitio);
  ok(hoja && hoja.datos.tipo === 'queja' && hoja.datos.email === 'ana@correo.pe', sitio + ': la hoja quedó en el motor');
}

// Lo Tuyo: vista dentro de la página (#libro-de-reclamaciones) y enlace en el pie
{
  const { ctx, page } = await abrir('https://lo-tuyo.netlify.app', p => (p === '/' ? LT : null), '/#libro-de-reclamaciones');
  ok(await page.locator('#foot [data-view="libro"]').count() === 1, 'lo-tuyo: enlace al libro en el pie');
  await llenarYEnviar(page, 'lo-tuyo');
  ok(await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0), 'lo-tuyo: el libro no guarda nada en el dispositivo');
  await ctx.close();
}
// Buen Partido: pantalla #libro y enlace en el pie de todas las páginas
{
  const servir = p => path.join(BP, p.endsWith('/') ? p + 'index.html' : p);
  const { ctx, page } = await abrir('https://buen-partido.netlify.app', servir, '/#libro');
  await llenarYEnviar(page, 'buen-partido');
  ok(fs.readFileSync(path.join(BP, 'apego-evitativo/index.html'), 'utf8').includes('href="/#libro"'), 'buen-partido: las guías enlazan el libro');
  await ctx.close();
}
// Buen Ojo: página /libro-de-reclamaciones/ y enlace en el pie
{
  const servir = p => path.join(BO, p.endsWith('/') ? p + 'index.html' : p);
  const { ctx, page } = await abrir('https://buen-ojo.netlify.app', servir, '/libro-de-reclamaciones/');
  ok(await page.locator('footer a[href="/libro-de-reclamaciones/"]').count() === 1, 'buen-ojo: enlace al libro en el pie');
  await llenarYEnviar(page, 'buen-ojo');
  await ctx.close();
}

await browser.close();
ok(errores.length === 0, 'errores en la página: ' + errores.join(' | '));
console.log(`Libro de Reclamaciones e2e: ${checks - failures}/${checks} verificaciones OK`);
if (failures) process.exit(1);
