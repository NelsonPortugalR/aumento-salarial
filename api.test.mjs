// Pruebas de las funciones de Netlify contra un servidor local de Netlify Blobs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { BlobsServer } from '@netlify/blobs/server';
import { getStore, setEnvironmentContext } from '@netlify/blobs';

let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error('FALLA:', msg); } };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blobs-'));
const server = new BlobsServer({ directory: dir, token: 'tok', port: 0 });
const { port } = await server.start();
setEnvironmentContext({ siteID: 'pidelo-test', token: 'tok', edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}` });
process.env.PANEL_TOKEN = 'token-de-prueba-largo';
globalThis.Netlify = { env: { get: k => process.env[k] } };

const { default: evento } = await import('./netlify/functions/evento.mjs');
const { default: aporte } = await import('./netlify/functions/aporte.mjs');
const { default: reclamo } = await import('./netlify/functions/reclamo.mjs');
const { default: panel } = await import('./netlify/functions/panel.mjs');
const { default: limpieza } = await import('./netlify/functions/limpieza.mjs');
const { claveEvento, leerClave, validarAporte, validarReclamo, numeroHoja, limaDia, limaMes } = await import('./netlify/lib/comun.mjs');

const post = (url, body) => new Request('https://pidelo.test' + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const get = (url, token) => new Request('https://pidelo.test' + url, { headers: token ? { authorization: 'Bearer ' + token } : {} });

// El registro que arma la app, con el motor real
const code = ['10_data.js', '15_bands.js', '20_engine.js'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
const { Engine } = vm.runInContext(code + '\n;({ Engine })', vm.createContext({}));
const answers = { puesto: 'contabilidad', nivel: 'analista', sector: 'industria', region: 'lima', tamano: 's3', contrato: 'indefinido', experiencia: 'e3', antiguedad: 't3', sueldo: '3000', aumento: 'a99', funciones: 'mas', logros: 'alguno', empresa: 'estable' };
const record = id => Object.assign(Engine.responseRecord(Object.assign({ _rid: id }, answers), Engine.recommend(answers, new Date())), { consentimiento: '2026-10' });

/* 1) Validación pura */
const k = claveEvento({ s: 'abc123xyz0', e: 'step', d: 'sueldo' });
ok(k && k.startsWith(limaDia() + '/abc123xyz0/') && k.endsWith('~step~sueldo'), 'clave de evento: ' + k);
ok(leerClave(k).e === 'step' && leerClave(k).d === 'sueldo', 'leer clave');
ok(claveEvento({ s: 'abc123xyz0', e: 'step', d: 'inventado' }) === null, 'paso inexistente aceptado');
ok(claveEvento({ s: 'ABC', e: 'visit' }) === null, 'sesión inválida aceptada');
ok(claveEvento({ s: 'abc123xyz0', e: 'hackeo' }) === null, 'evento desconocido aceptado');
ok(claveEvento({ s: 'abc123xyz0', e: 'visit', d: 'p2990.facebook.m/../x' }) === null, 'detalle con barra aceptado');
ok(claveEvento({ s: 'abc123xyz0', e: 'exit_route', d: 'publico' }) !== null, 'salida válida rechazada');
const v = validarAporte(Object.assign(record('aaaaaa1111'), { nombre: 'Ana', dni: '12345678', ip: '1.2.3.4' }));
ok(v && v.sueldo === 3000 && v.puesto === 'contabilidad' && v.mes === limaMes(), 'aporte válido rechazado');
ok(v && !('nombre' in v) && !('dni' in v) && !('ip' in v), 'el aporte guarda campos que no debe');
ok(validarAporte(Object.assign(record('aaaaaa1111'), { puesto: 'astronauta' })) === null, 'puesto fuera de catálogo aceptado');
ok(validarAporte(Object.assign(record('aaaaaa1111'), { sueldo: 999999 })) === null, 'sueldo fuera de rango aceptado');
ok(validarAporte(Object.assign(record('aaaaaa1111'), { consentimiento: '2099-01' })) === null, 'consentimiento futuro aceptado');
ok(validarAporte(Object.assign(record('aaaaaa1111'), { contrato: 'rxh' })) === null, 'salida honesta aceptada como aporte');
ok(!('vence' in validarAporte(Object.assign(record('aaaaaa1111'), { vence: 'v3' }))), 'vence sin plazo fijo');
ok(validarReclamo({ nombre: 'Ana Pérez', documento: '12345678', email: 'ana@correo.pe', tipo: 'reclamo', detalle: 'No pude ver el kit.', pedido: 'Que me den acceso.' }), 'reclamo válido rechazado');
ok(!validarReclamo({ nombre: 'Ana', documento: '1', email: 'sin-arroba', tipo: 'reclamo', detalle: 'x', pedido: 'y' }), 'reclamo sin correo aceptado');
ok(numeroHoja('2026', 7) === '000007-2026', 'formato del número de hoja');

/* 2) Eventos y resumen */
const send = async (s, e, d) => (await evento(post('/api/evento', { s, e, d }))).status;
ok(await send('sesionuno1', 'visit', 'p2990.compartido.m') === 204, 'evento válido no guardado');
ok(await send('sesionuno1', 'nada') === 400, 'evento inválido aceptado');
ok((await evento(post('/api/evento', 'no es json'))).status === 400, 'cuerpo inválido aceptado');
for (const [e, d] of [['test_start', ''], ['step', 'nivel'], ['step', 'sector'], ['test_complete', 'pide_ahora.bajo'], ['paywall_view', 'p2990'], ['pay_click', 'p2990']]) await send('sesionuno1', e, d);
await send('sesiondos2', 'visit', 'p4990.directo.d');
await send('sesiondos2', 'test_start');
await send('sesiondos2', 'step', 'nivel');
await send('sesiontres', 'visit', 'p2990.facebook.m');
ok((await panel(get('/api/resumen?dias=7'))).status === 401, 'resumen sin token');
ok((await panel(get('/api/resumen?dias=7', 'otro'))).status === 401, 'resumen con token equivocado');
const res = await panel(get('/api/resumen?dias=7', 'token-de-prueba-largo'));
const r = await res.json();
ok(res.status === 200 && r.embudo.visitas === 3 && r.embudo.iniciaron === 2 && r.embudo.completaron === 1 && r.embudo.clic_en_pagar === 1, 'embudo: ' + JSON.stringify(r.embudo));
ok(r.tasas.inicio_a_completo === 0.5 && r.tasas.muro_a_clic === 1, 'tasas: ' + JSON.stringify(r.tasas));
ok(r.pasos.find(p => p.paso === 'nivel').sesiones === 2 && r.pasos.find(p => p.paso === 'sector').sesiones === 1, 'abandono por pregunta');
ok(r.precios.find(p => p.valor === 'p2990').visitas === 2 && r.precios.find(p => p.valor === 'p4990').visitas === 1, 'prueba de precio');
ok(r.resultados[0].valor === 'pide_ahora' && r.zonas[0].valor === 'bajo', 'resultados');
ok(r.diario.length === 7 && r.diario[6].visitas === 3, 'serie diaria');

/* 3) Aportes: sin duplicados y exportables */
ok((await aporte(post('/api/aporte', record('bbbbbb2222')))).status === 200, 'aporte válido rechazado');
ok((await aporte(post('/api/aporte', record('bbbbbb2222')))).status === 200, 'aporte repetido falla');
ok((await aporte(post('/api/aporte', Object.assign(record('cccccc3333'), { sueldo: 10 })))).status === 400, 'aporte inválido aceptado');
const exp = await panel(get('/api/exportar?tipo=aportes', 'token-de-prueba-largo'));
const lines = (await exp.text()).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
ok(lines.length === 1 && lines[0].id === 'bbbbbb2222' && lines[0].consentimiento === '2026-10', 'exportación de aportes: ' + lines.length);
ok(/attachment; filename="aportes_/.test(exp.headers.get('content-disposition')), 'nombre del archivo exportado');
const csv = await (await panel(get('/api/exportar?tipo=eventos&dias=7', 'token-de-prueba-largo'))).text();
ok(csv.startsWith('dia,sesion,orden,evento,detalle') && csv.trim().split('\n').length === 12, 'exportación de eventos');

/* 4) Libro de Reclamaciones: números correlativos sin choques */
const hoja = { nombre: 'Ana Pérez', documento: '12345678', email: 'ana@correo.pe', tipo: 'queja', detalle: 'Demoraron en responder.', pedido: 'Respuesta.' };
const n1 = await (await reclamo(post('/api/reclamo', hoja))).json();
const n2 = await (await reclamo(post('/api/reclamo', hoja))).json();
const anio = limaDia().slice(0, 4);
ok(n1.numero === `000001-${anio}` && n2.numero === `000002-${anio}`, `correlativo: ${n1.numero} ${n2.numero}`);
// En Netlify la escritura condicional es atómica; el emulador local no, así que aquí las hojas van en serie
const par = [];
for (let i = 0; i < 6; i++) par.push(await (await reclamo(post('/api/reclamo', hoja))).json());
ok(par.map(x => x.numero).join() === [3, 4, 5, 6, 7, 8].map(n => numeroHoja(anio, n)).join(), 'números de hoja: ' + par.map(x => x.numero));
ok((await reclamo(post('/api/reclamo', { nombre: 'x' }))).status === 400, 'reclamo incompleto aceptado');
const guardado = await getStore('reclamos').get(`${anio}/000001`);
ok(guardado && !guardado.includes('Ana'), 'el correlativo no debe guardar datos personales');
const r2 = await (await panel(get('/api/resumen?dias=7', 'token-de-prueba-largo'))).json();
ok(r2.reclamos.total === 8 && r2.aportes.total === 1, 'resumen de aportes y reclamos');

/* 5) Limpieza: plazos de la política de privacidad */
const viejo = limaDia(new Date(Date.now() - 800 * 86400e3));
await getStore('eventos').set(`${viejo}/sesionvieja/x~visit`, '1');
await getStore('aportes').setJSON(`2019-01/dddddd4444`, { id: 'dddddd4444' });
await limpieza(new Request('https://pidelo.test/'));
ok((await getStore('eventos').list({ prefix: viejo + '/' })).blobs.length === 0, 'evento de más de 2 años no se borró');
ok((await getStore('aportes').list({ prefix: '2019-01/' })).blobs.length === 0, 'aporte de más de 5 años no se borró');
ok((await getStore('eventos').list({ prefix: limaDia() + '/' })).blobs.length === 11, 'la limpieza borró eventos recientes');
ok((await getStore('aportes').list()).blobs.length === 1, 'la limpieza borró aportes recientes');

await server.stop();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`api.test: ${checks - failures}/${checks} verificaciones OK`);
if (failures) process.exit(1);
