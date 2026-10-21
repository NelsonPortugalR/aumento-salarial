// Pruebas de la versión web (web/): medición, aporte, precio A/B, enlaces legales, Libro de Reclamaciones y panel.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const errors = [];
let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error('FALLA:', msg); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const read = f => fs.readFileSync('web/' + f, 'utf8');
// Las páginas cargan sus scripts con src; en la prueba van en línea
const inline = (html, src, code) => html.replace(`<script src="${src}"></script>`, () => `<script>${code}</script>`);

function page(file, src, code, opts = {}) {
  const sent = [];
  const dom = new JSDOM(inline(read(file), src, code), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pidelo.test/' + (opts.path || ''),
    referrer: opts.referrer,
    beforeParse(w) {
      w.addEventListener('error', e => errors.push(file + ': ' + (e.error && e.error.stack || e.message)));
      w.scrollTo = () => {};
      w.fetch = async (url, init = {}) => {
        sent.push({ url: String(url), init, body: init.body });
        const r = opts.respond ? await opts.respond(String(url), init) : { status: 200, json: {} };
        return { ok: r.status < 400, status: r.status, json: async () => r.json, text: async () => JSON.stringify(r.json), headers: { get: () => null }, blob: async () => new w.Blob(['x']) };
      };
      if (opts.before) opts.before(w);
    }
  });
  return { dom, w: dom.window, d: dom.window.document, sent };
}
const events = sent => sent.filter(s => s.url === '/api/evento').map(s => JSON.parse(s.body));

(async () => {
  const app = read('app.js');

  /* 1) App: embudo medido, sin datos personales, con precio y enlaces legales */
  {
    const { w, d, sent } = page('index.html', '/app.js', app, { path: '?utm_source=LinkedIn' });
    await wait(30);
    const click = sel => d.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const pick = async (step, value) => { click(`[data-step="${step}"][data-value="${value}"]`); await wait(200); };
    const type = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
    const links = [...d.querySelectorAll('.legal-links a')].map(a => a.getAttribute('href'));
    ok(links.join() === '/terminos,/privacidad,/libro-de-reclamaciones', 'enlaces legales en el pie: ' + links);
    ok(!/fonts\.googleapis/.test(d.documentElement.outerHTML), 'la web no debe cargar Google Fonts');
    ok(d.querySelector('meta[property="og:image"]').content.endsWith('/og.png'), 'falta la imagen para compartir');
    await pick('puesto', 'contabilidad'); await pick('nivel', 'analista'); await pick('sector', 'industria'); await pick('region', 'lima');
    await pick('tamano', 's3'); await pick('contrato', 'indefinido'); await pick('experiencia', 'e3'); await pick('antiguedad', 't3');
    type('#sueldo', '2400'); click('[data-action="salary-next"]'); await wait(40);
    await pick('aumento', 'a99'); await pick('funciones', 'personas'); await pick('logros', 'varios'); await pick('empresa', 'estable');
    await wait(40);
    const ev = events(sent);
    const names = ev.map(e => e.e);
    ok(ev[0].e === 'visit' && /^p2990\.linkedin\.(m|d)$/.test(ev[0].d), 'visita con precio, origen y equipo: ' + JSON.stringify(ev[0]));
    ok(names.filter(n => n === 'test_start').length === 1, 'test_start debe enviarse una vez');
    ok(ev.filter(e => e.e === 'step').map(e => e.d).join() === 'nivel,sector,region,tamano,contrato,experiencia,antiguedad,sueldo,aumento,funciones,logros,empresa', 'pasos medidos: ' + ev.filter(e => e.e === 'step').map(e => e.d));
    const done = ev.find(e => e.e === 'test_complete');
    ok(done && /^[a-z_]+\.(bajo|rango|alto)$/.test(done.d), 'test_complete con recomendación y zona: ' + JSON.stringify(done));
    ok(new Set(ev.map(e => e.s)).size === 1 && /^[a-z0-9]{10}$/.test(ev[0].s), 'una sola sesión aleatoria por pestaña');
    ok(!JSON.stringify(ev).includes('2400') && !JSON.stringify(ev).includes('contabilidad'), 'los eventos no deben llevar respuestas ni sueldo');
    // Aporte con consentimiento expreso y código para retirarlo
    ok(!sent.some(s => s.url === '/api/aporte'), 'el aporte no debe enviarse sin tocar el botón');
    ok(/Netlify en Estados Unidos/.test(d.querySelector('.contribute').textContent), 'el consentimiento debe decir dónde se guarda');
    click('[data-action="contribute"]'); await wait(30);
    const ap = sent.find(s => s.url === '/api/aporte');
    const rec = ap && JSON.parse(ap.body);
    ok(rec && rec.consentimiento === '2026-10' && rec.sueldo === 2400 && /^[a-z0-9]{10}$/.test(rec.id), 'aporte enviado: ' + (ap && ap.body));
    ok(d.body.textContent.includes('escríbenos con este código: ' + rec.id), 'falta el código para retirar el aporte');
    // Precio, términos y medición del muro
    click('[data-action="open-paywall"]'); await wait(20);
    ok(d.querySelector('.price').textContent.includes('29.90') && /incluye IGV/.test(d.getElementById('modal-root').textContent), 'precio con IGV en el muro');
    ok(d.querySelector('#modal-root a[href="/terminos"]'), 'el muro debe enlazar los términos');
    ok(events(sent).some(e => e.e === 'paywall_view' && e.d === 'p2990'), 'paywall_view con variante');
    ok(!d.querySelector('[data-action="polish"]') || d.querySelector('[data-action="polish"]').hidden, 'sin IA en la web');
    // Compartir con enlace
    ok(w.shareText().endsWith(' https://pidelo.test/?ref=compartido'), 'compartir sin enlace: ' + w.shareText());
  }

  /* 1b) Modo interno: las pruebas de quien administra no se miden ni se aportan */
  {
    const { w, d, sent } = page('index.html', '/app.js', app, { path: '?interno=1' });
    await wait(20);
    d.querySelector('[data-step="puesto"][data-value="ventas"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(200);
    ok(w.localStorage.getItem('pidelo-bien-interno') === '1' && sent.length === 0, 'el modo interno no debe enviar eventos: ' + sent.length);
  }

  /* 2) Prueba A/B: se activa con dos links de pago y el precio queda fijo en el navegador */
  {
    const abApp = app.replace("{ price: 29.90, payUrl: '' }", "{ price: 29.90, payUrl: 'https://pago.test/a' }").replace("{ price: 49.90, payUrl: '' }", "{ price: 49.90, payUrl: 'https://pago.test/b' }");
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const { w, d, sent } = page('index.html', '/app.js', abApp);
      await wait(10);
      const o = w.offer();
      seen.add(o.variant);
      ok(w.offer() === o && w.localStorage.getItem('pidelo-bien-precio') !== null, 'variante inestable');
      ok(o.payUrl === (o.price === 29.9 ? 'https://pago.test/a' : 'https://pago.test/b'), 'link de pago de otra variante');
      if (i === 0) {
        const click = sel => d.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        // S es una constante del script de la app: se llega a ella con eval en el contexto de la página
        w.eval(`S.view = 'result'; Object.assign(S.answers, { puesto: 'ventas', nivel: 'analista', sector: 'comercio', region: 'lima', tamano: 's3', contrato: 'indefinido', experiencia: 'e1', antiguedad: 't2', sueldo: '2500', aumento: 'a24', funciones: 'mas', logros: 'alguno', empresa: 'crece' }); render();`);
        await wait(10);
        click('[data-action="open-paywall"]'); await wait(10);
        const pay = d.querySelector('[data-action="pay"]');
        ok(pay && pay.getAttribute('href') === o.payUrl && pay.textContent.includes(o.price.toFixed(2)), 'botón de pago de la variante');
        pay.addEventListener('click', e => e.preventDefault());
        click('[data-action="pay"]'); await wait(10);
        ok(events(sent).some(e => e.e === 'pay_click' && e.d === o.variant), 'pay_click con variante');
      }
    }
    ok(seen.size === 2, 'la prueba A/B debe repartir ambas variantes: ' + [...seen]);
  }

  /* 3) Libro de Reclamaciones: número, envío a Netlify Forms y constancia */
  {
    const html = read('libro-de-reclamaciones.html');
    ok(/<form[^>]+name="libro-reclamaciones"[^>]+data-netlify="true"[^>]+netlify-honeypot="bot-field"/.test(html), 'formulario sin atributos de Netlify Forms');
    ok(/Razón social por completar/.test(html), 'los datos legales vacíos deben verse como pendientes');
    const { w, d, sent } = page('libro-de-reclamaciones.html', '/js/libro.js', read('js/libro.js'), {
      respond: url => url === '/api/reclamo' ? { status: 200, json: { ok: true, numero: '000001-2026', fecha: '2026-10-21T15:30:00.000Z' } } : { status: 200, json: {} }
    });
    await wait(20);
    const f = d.getElementById('lr-form');
    const set = (n, v) => { f.elements[n].value = v; };
    set('nombre', 'Ana Pérez'); set('documento', '12345678'); set('domicilio', 'Av. Arequipa 123, Lima'); set('email', 'ana@correo.pe');
    set('detalle', 'Pagué y no recibí el código.'); set('pedido', 'Que me envíen el código.');
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await wait(60);
    const toForms = sent.find(s => s.url === '/' && s.init.method === 'POST');
    ok(sent[0].url === '/api/reclamo' && toForms, 'flujo de envío: ' + sent.map(s => s.url));
    const body = new w.URLSearchParams(toForms.body);
    ok(body.get('numero') === '000001-2026' && body.get('nombre') === 'Ana Pérez' && body.get('tipo') === 'reclamo' && body.get('bot-field') === '', 'datos enviados a Netlify Forms');
    ok(!d.getElementById('lr-constancia').hidden && d.getElementById('lr-numero').textContent === '000001-2026', 'constancia con número');
    ok(d.getElementById('lr-datos').textContent.includes('Pagué y no recibí el código.'), 'constancia con el detalle');
  }

  /* 4) Panel: pide token, muestra el embudo y vuelve al ingreso si el token no sirve */
  {
    const { resumir } = await import('./netlify/lib/metricas.mjs');
    const hoy = new Date().toISOString().slice(0, 10);
    const claves = [`${hoy}/aaaaaa1111/1~visit~p2990.directo.m`, `${hoy}/aaaaaa1111/2~test_start`, `${hoy}/aaaaaa1111/3~step~nivel`, `${hoy}/aaaaaa1111/4~test_complete~pide_ahora.bajo`, `${hoy}/bbbbbb2222/1~visit~p2990.google.d`];
    const resumen = Object.assign({ generado: hoy, dias: 30, desde: hoy, hasta: hoy, eventos: claves.length, aportes: { total: 3, por_mes: { '2026-10': 3 } }, reclamos: { anio: '2026', total: 0 } }, resumir(claves, [hoy]));
    const { d, sent } = page('panel.html', '/js/panel.js', read('js/panel.js'), {
      before: w => w.localStorage.setItem('pidelo-bien-panel', 'tok'),
      respond: url => url.startsWith('/api/resumen') ? { status: 200, json: resumen } : { status: 404, json: {} }
    });
    await wait(60);
    ok(sent[0].init.headers.Authorization === 'Bearer tok', 'el panel debe enviar el token');
    ok(d.querySelectorAll('.kpi').length === 6 && d.querySelector('.kpi .v').textContent === '2', 'indicadores del panel');
    ok(d.querySelectorAll('.bars li').length === 8 + 14, 'barras de embudo y preguntas');
    ok(d.querySelector('.chart svg polyline') && d.querySelector('details.table-view table'), 'gráfico diario con tabla');
    const bad = page('panel.html', '/js/panel.js', read('js/panel.js'), { before: w => w.localStorage.setItem('pidelo-bien-panel', 'malo'), respond: () => ({ status: 401, json: {} }) });
    await wait(60);
    ok(!bad.d.getElementById('p-login').hidden && /no es válido/.test(bad.d.getElementById('p-err').textContent), 'token inválido vuelve al ingreso');
  }

  if (errors.length) { failures += errors.length; console.error(errors.join('\n')); }
  console.log(`web.test: ${checks - failures}/${checks} verificaciones OK`);
  if (failures) process.exit(1);
})().catch(e => { console.error('TEST FAILURE', e); process.exit(1); });
