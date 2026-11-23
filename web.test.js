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
      // Con la prueba de precio activa cada navegador sortea su precio: las pruebas fijan el primero salvo que pidan sorteo
      if (opts.precio !== 'azar') w.localStorage.setItem('pidelo-bien-precio', String(opts.precio || 0));
      if (opts.before) opts.before(w);
    }
  });
  return { dom, w: dom.window, d: dom.window.document, sent };
}
const events = sent => sent.filter(s => s.url === '/api/evento').map(s => JSON.parse(s.body));

(async () => {
  const app = read('app.js');

  /* 0) SEO: canonical, datos estructurados, sitemap y páginas de sueldos */
  {
    const faq = JSON.parse(fs.readFileSync('web-src/faq.json', 'utf8'));
    const { d } = page('index.html', '/app.js', app);
    await wait(30);
    const canon = d.querySelector('link[rel="canonical"]').href;
    ok(canon === d.querySelector('meta[property="og:url"]').content && /^https:\/\/[a-z0-9.-]+\/$/.test(canon), 'canonical de la portada: ' + canon);
    const lds = [...d.querySelectorAll('script[type="application/ld+json"]')].map(x => JSON.parse(x.textContent));
    ok(lds.some(x => x['@type'] === 'WebApplication') && lds.some(x => x['@type'] === 'FAQPage' && x.mainEntity.length === faq.length), 'JSON-LD de la portada');
    ok(d.querySelectorAll('.faq details').length === faq.length, 'FAQ visible con todas las preguntas');
    ok(d.querySelectorAll('.home-extra .guias-lista a').length === 4, 'enlaces internos a guías y sueldos');
    const sm = read('sitemap.xml');
    ok((sm.match(/<loc>/g) || []).length === 28 && sm.includes('/sueldos/contabilidad</loc>') && !sm.includes('/panel'), 'sitemap con 28 rutas y sin panel');
    ok(/Sitemap: .*\/sitemap\.xml/.test(read('robots.txt')), 'robots.txt apunta al sitemap');
    for (const f of ['como-pedir-aumento-de-sueldo.html', 'sueldos/contabilidad.html', 'sueldos/index.html']) {
      const h = read(f);
      ok(h.includes('rel="canonical"') && h.includes('og:title') && !/NaN|undefined/.test(h), 'página SEO incompleta: ' + f);
      ok((h.match(/href="\/"/g) || []).length >= 1, f + ' no enlaza al test');
      const mld = h.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
      if (mld) JSON.parse(mld[1]);
    }
    const su = read('sueldos/contabilidad.html');
    ok(/S\/\u00A0[\d,]+/u.test(su.replace(/&nbsp;/g, '\u00A0')) || /S\//.test(su), 'la página de sueldos no muestra cifras');
    ok(su.includes('Confianza') && su.includes('P75') && su.split('<tr>').length === 8, 'tabla de niveles incompleta');
  }

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
    const wa = d.querySelector('#modal-root a[data-action="wa"]');
    ok(wa && wa.href.startsWith('https://wa.me/51994607605?text=') && /quiero%20el%20kit/.test(wa.href) && /Pedir el kit por WhatsApp/.test(wa.textContent), 'sin cobro con tarjeta, el kit se pide por WhatsApp');
    ok(events(sent).some(e => e.e === 'paywall_view' && e.d === 'p2990'), 'paywall_view con variante');
    ok(!d.querySelector('[data-action="polish"]') || d.querySelector('[data-action="polish"]').hidden, 'sin IA en la web');
    // Compartir con enlace
    ok(w.shareText().endsWith(' https://pidelo.test/?ref=compartido'), 'compartir sin enlace: ' + w.shareText());
  }

  /* 1a) Portada: las secciones informativas se ocultan al avanzar y vuelven al reiniciar */
  {
    const { w, d } = page('index.html', '/app.js', app);
    await wait(30);
    const hx = () => d.querySelector('.home-extra');
    ok(hx() && !hx().hidden, 'las secciones de la portada deberían verse en la primera pregunta');
    d.querySelector('[data-step="puesto"][data-value="ventas"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(220);
    ok(hx().hidden, 'las secciones deberían ocultarse al pasar a la segunda pregunta');
  }

  /* 1b) Modo interno: las pruebas de quien administra no se miden ni se aportan */
  {
    const { w, d, sent } = page('index.html', '/app.js', app, { path: '?interno=1' });
    await wait(20);
    d.querySelector('[data-step="puesto"][data-value="ventas"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(200);
    const enviados = sent.filter(s => ['/api/evento', '/api/aporte'].includes(s.url));
    ok(w.localStorage.getItem('pidelo-bien-interno') === '1' && enviados.length === 0, 'el modo interno no debe enviar eventos: ' + enviados.length);
  }

  /* 2) Prueba A/B: se activa con dos links de pago y el precio queda fijo en el navegador */
  {
    const abApp = app.replace("{ price: 29.90, payUrl: '' }", "{ price: 29.90, payUrl: 'https://pago.test/a' }").replace("{ price: 49.90, payUrl: '' }", "{ price: 49.90, payUrl: 'https://pago.test/b' }");
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const { w, d, sent } = page('index.html', '/app.js', abApp, { precio: 'azar' });
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

  /* 2b) Cobro con tarjeta: crear el pago, ir a Mercado Pago, volver y desbloquear */
  {
    const RESP = { puesto: 'contabilidad', nivel: 'analista', sector: 'industria', region: 'lima', tamano: 's3', contrato: 'indefinido', experiencia: 'e3', antiguedad: 't3', sueldo: '2400', aumento: 'a99', funciones: 'mas', logros: 'alguno', empresa: 'estable' };
    const estadoGuardado = w => w.localStorage.setItem('pidelo-bien-v2', JSON.stringify({ view: 'result', stepId: 'empresa', answers: RESP, unlocked: false }));
    const PED = 'a'.repeat(24);
    const C = 'https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros';
    // a) Ir a pagar
    const { w, d, sent } = page('index.html', '/app.js', app, {
      before: estadoGuardado,
      respond: (url, init) => url === `${C}/disponible?producto=pidelo-bien-kit` ? { status: 200, json: { disponible: true } }
        : url === `${C}/crear` ? { status: 200, json: { pedido: PED, url: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=x' } }
        : { status: 200, json: {} }
    });
    await wait(40);
    let destino = '';
    w.irA = u => { destino = u; };
    d.querySelector('[data-action="open-paywall"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(20);
    const boton = d.querySelector('[data-action="checkout"]');
    ok(boton && /Pagar S\/\s29\.90 con tarjeta/.test(boton.textContent) && !d.querySelector('[data-action="pay"]'), 'botón de pago con tarjeta en el muro');
    const ayuda = d.querySelector('#modal-root a[data-action="wa"]');
    ok(ayuda && /duda/.test(decodeURIComponent(ayuda.href)) && !/Pedir el kit/.test(d.getElementById('modal-root').textContent), 'con tarjeta, WhatsApp queda solo para dudas');
    boton.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(40);
    const crear = sent.find(s => s.url === `${C}/crear`);
    const cuerpo = crear && JSON.parse(crear.body);
    ok(cuerpo && cuerpo.producto === 'pidelo-bien-kit' && cuerpo.variante === 'p2990' && cuerpo.volver === 'https://pidelo.test/' && !('precio' in cuerpo) && !('monto' in cuerpo), 'el pedido viaja al motor central con producto, variante y vuelta, sin precio: ' + (crear && crear.body));
    ok(destino.startsWith('https://www.mercadopago.com.pe/') && JSON.parse(w.localStorage.getItem('pidelo-bien-pedido')).id === PED, 'redirige a Mercado Pago y recuerda el pedido');
    ok(events(sent).some(e => e.e === 'pay_click' && e.d === 'p2990'), 'pay_click al ir a pagar');

    // b) Volver con el pago aprobado
    const ok2 = page('index.html', '/app.js', app, {
      path: `?pago=${PED}&collection_status=approved&payment_id=1`, before: estadoGuardado,
      respond: url => url === `${C}/estado?pedido=${PED}` ? { status: 200, json: { estado: 'pagado', codigo: 'PB-ABCD-EFGH', variante: 'p2990' } } : { status: 200, json: {} }
    });
    await wait(80);
    ok(ok2.w.eval('S.unlocked') === true && ok2.w.eval('S.accessCode') === 'PB-ABCD-EFGH', 'el kit se desbloquea al volver con el pago aprobado');
    ok(events(ok2.sent).filter(e => e.e === 'paid' && e.d === 'p2990').length === 1, 'el pago queda en el embudo una sola vez, con su precio');
    ok(/PB-ABCD-EFGH/.test(ok2.d.getElementById('modal-root').textContent) && ok2.w.location.search === '', 'muestra el código y limpia la dirección');
    ok2.d.querySelector('[data-action="go-interview"]').dispatchEvent(new ok2.w.MouseEvent('click', { bubbles: true }));
    await wait(20);
    ok(ok2.d.querySelector('[data-kf="logro1"]'), 'de la confirmación pasa a armar el kit');

    // c) Volver con el pago rechazado
    const no = page('index.html', '/app.js', app, {
      path: `?pago=${'b'.repeat(24)}`, before: estadoGuardado,
      respond: url => url.startsWith(`${C}/estado`) ? { status: 200, json: { estado: 'rechazado' } } : { status: 200, json: {} }
    });
    await wait(80);
    ok(no.w.eval('S.unlocked') === false && /no se completó/.test(no.d.getElementById('modal-root').textContent), 'pago rechazado: no desbloquea y lo explica');

    // d) Código de compra en otro equipo
    const otro = page('index.html', '/app.js', app, {
      before: estadoGuardado,
      respond: url => url === `${C}/codigo` ? { status: 200, json: { ok: true } } : { status: 200, json: {} }
    });
    await wait(40);
    otro.d.querySelector('[data-action="open-paywall"]').dispatchEvent(new otro.w.MouseEvent('click', { bubbles: true }));
    await wait(20);
    otro.d.getElementById('code').value = 'pb-abcd-efgh';
    otro.d.querySelector('[data-action="redeem"]').dispatchEvent(new otro.w.MouseEvent('click', { bubbles: true }));
    await wait(80);
    ok(otro.w.eval('S.unlocked') === true && otro.sent.some(s => s.url === `${C}/codigo` && JSON.parse(s.body).codigo === 'PB-ABCD-EFGH' && JSON.parse(s.body).producto === 'pidelo-bien-kit'), 'un código de compra desbloquea en otro equipo');
  }

  /* 3) Libro de Reclamaciones: número, envío a Netlify Forms y constancia */
  ok(!/garantía de/i.test(read('terminos.html')), 'los términos no deben ofrecer garantía de devolución');
  {
    const html = read('libro-de-reclamaciones.html');
    ok(/<form[^>]+name="libro-reclamaciones"[^>]+data-netlify="true"[^>]+netlify-honeypot="bot-field"/.test(html), 'formulario sin atributos de Netlify Forms');
    ok(/RUC por completar/.test(html) && html.includes('<dd>Portugal Research International S.A.C.</dd>'), 'los datos legales vacíos deben verse como pendientes y los completos, tal cual');
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
    const C = 'https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros';
    const central = {
      productos: [{ id: 'pidelo-bien-kit', sitio: 'pidelo-bien' }, { id: 'lo-tuyo-reporte', sitio: 'lo-tuyo' }, { id: 'buen-ojo-reporte', sitio: 'buen-ojo' }],
      mercado_pago: false,
      ventas: { total: 2, monto: 68.9, por_producto: {
        'pidelo-bien-kit': { ventas: 1, monto: 29.9, por_variante: { p2990: { ventas: 1, monto: 29.9 } }, por_dia: { [hoy]: { ventas: 1, monto: 29.9 } } },
        'lo-tuyo-reporte': { ventas: 1, monto: 39, por_variante: { unico: { ventas: 1, monto: 39 } }, por_dia: { '2020-01-01': { ventas: 1, monto: 39 } } } } },
      reclamos: [{ id: 7, sitio: 'buen-ojo', numero: '000001-2026', creado: new Date().toISOString(), respondido: null, datos: { nombre: 'Ana Pérez', tipo_documento: 'DNI', documento: '12345678', email: 'ana@correo.pe', tipo: 'reclamo', detalle: 'No abrió el reporte.', pedido: 'Que lo arreglen.' } }]
    };
    const { w, d, sent } = page('panel.html', '/js/panel.js', read('js/panel.js'), {
      before: w => w.localStorage.setItem('pidelo-bien-panel', 'tok'),
      respond: url => url.startsWith('/api/resumen') ? { status: 200, json: resumen }
        : url === `${C}/resumen` ? { status: 200, json: central }
        : url === `${C}/reclamo/respondido` ? { status: 200, json: { ok: true } } : { status: 404, json: {} }
    });
    await wait(60);
    ok(sent[0].init.headers.Authorization === 'Bearer tok', 'el panel debe enviar el token');
    ok(sent.some(s => s.url === `${C}/resumen` && s.init.headers['x-panel'] === 'tok'), 'el panel pide ventas y reclamos al motor central con el mismo token');
    ok(d.querySelectorAll('.kpi').length === 7 && d.querySelector('.kpi .v').textContent === '2', 'indicadores del panel');
    const kVentas = [...d.querySelectorAll('.kpi')].find(k => k.querySelector('.k').textContent === 'Ventas');
    ok(kVentas && kVentas.querySelector('.v').textContent === '1' && /S\/ 29\.90/.test(kVentas.textContent), 'ventas de Pídelo Bien en el periodo, desde el motor central');
    const vc = [...d.querySelectorAll('.card')].find(c => c.querySelector('h2').textContent === 'Ventas de tus tests');
    ok(vc && vc.querySelectorAll('tbody tr').length === 3 && /Lo Tuyo/.test(vc.textContent) && /S\/ 39\.00/.test(vc.textContent), 'tabla de ventas de todas las páginas');
    const rc = [...d.querySelectorAll('.card')].find(c => /Libro de Reclamaciones de Lo Tuyo/.test(c.querySelector('h2').textContent));
    ok(rc && /1 hoja pendiente/.test(rc.textContent) && /Buen Ojo · Hoja 000001-2026/.test(rc.textContent) && /Ana Pérez/.test(rc.textContent), 'hojas de reclamación de las otras páginas');
    rc.querySelector('[data-respondido]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(40);
    const marca = sent.find(s => s.url === `${C}/reclamo/respondido`);
    ok(marca && JSON.parse(marca.body).id === 7 && marca.init.headers['x-panel'] === 'tok', 'marcar una hoja como respondida');
    ok(d.querySelectorAll('.bars li').length === 9 + 14, 'barras de embudo y preguntas');
    ok(d.querySelector('.chart svg polyline') && d.querySelector('details.table-view table'), 'gráfico diario con tabla');
    const bad = page('panel.html', '/js/panel.js', read('js/panel.js'), { before: w => w.localStorage.setItem('pidelo-bien-panel', 'malo'), respond: () => ({ status: 401, json: {} }) });
    await wait(60);
    ok(!bad.d.getElementById('p-login').hidden && /no es válido/.test(bad.d.getElementById('p-err').textContent), 'token inválido vuelve al ingreso');
  }

  if (errors.length) { failures += errors.length; console.error(errors.join('\n')); }
  console.log(`web.test: ${checks - failures}/${checks} verificaciones OK`);
  if (failures) process.exit(1);
})().catch(e => { console.error('TEST FAILURE', e); process.exit(1); });
