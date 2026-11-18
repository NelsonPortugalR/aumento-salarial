// Pruebas del servicio de cobros con la tienda en memoria y Mercado Pago simulado.
import { atender, limitador, nuevoCodigo, huellaCodigo, origenPermitido, urlDeVuelta, sha256 } from '../supabase/functions/cobros/nucleo.js';
import { tiendaMemoria, mercadoPagoSimulado } from './memoria.mjs';

let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error('FALLA:', msg); } };

const TOKEN = 'APP_USR-prueba';
const PANEL = 'token-del-panel-de-prueba';
const BASE = 'https://proyecto.supabase.co/functions/v1/cobros';
const PRODUCTOS = [
  { id: 'pidelo-bien-kit', sitio: 'pidelo-bien', nombre: 'Kit para negociar tu sueldo (Pídelo Bien)', precios: { p2990: 29.9, p4990: 49.9 }, origenes: ['https://pidelo-bien.netlify.app', 'https://*--pidelo-bien.netlify.app'], descriptor: 'PIDELOBIEN', prefijo: 'PB' },
  { id: 'buen-partido-reporte', sitio: 'buen-partido', nombre: 'Reporte completo y plan de 30 días (Buen Partido)', precios: { a: 39, b: 59 }, cupones: { PATA20: 20 }, origenes: ['https://buen-partido.netlify.app'], descriptor: 'BUENPARTIDO', prefijo: 'BP' },
  { id: 'lo-tuyo-reporte', sitio: 'lo-tuyo', nombre: 'Reporte personalizado', precios: { unico: 39 }, origenes: ['https://lo-tuyo.netlify.app'], descriptor: 'PORTUGALRI', prefijo: 'LT' },
  { id: 'apagado', sitio: 'otro', nombre: 'Producto apagado', precios: { x: 10 }, origenes: ['https://otro.example'], descriptor: 'OTRO', prefijo: 'OT', activo: false }
];

const tienda = tiendaMemoria({ productos: PRODUCTOS, panelHuella: await sha256(PANEL) });
const MP = mercadoPagoSimulado(TOKEN);
const limites = new Map();
let token = TOKEN, ipActual = '1.1.1.1';
const ctx = () => ({
  tienda, token, base: BASE, fetch: MP.fetch, ahora: () => new Date(), log: () => {},
  limite: (k, max) => { if (!limites.has(max)) limites.set(max, limitador(max, 600e3)); return limites.get(max)(k); }
});
async function llamar(method, ruta, { cuerpo, panel, ip } = {}) {
  const r = await atender({ method, url: new URL(BASE + ruta), texto: cuerpo === undefined ? '' : (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)), ip: ip || ipActual, panel: panel || '' }, ctx());
  return { status: r.status, headers: r.headers, json: r.body ? JSON.parse(r.body) : null };
}
const pagar = (pedido, monto, extra = {}) => { const id = 9000 + MP.pagos.length; MP.pagos.push({ id, external_reference: pedido, status: 'approved', currency_id: 'PEN', transaction_amount: monto, ...extra }); return id; };

// CORS y disponibilidad
let r = await llamar('OPTIONS', '/crear');
ok(r.status === 204 && r.headers['Access-Control-Allow-Origin'] === '*' && /x-panel/.test(r.headers['Access-Control-Allow-Headers']), 'preflight CORS');
ok((await llamar('GET', '/disponible?producto=lo-tuyo-reporte')).json.disponible === true, 'disponible con clave y producto activo');
ok((await llamar('GET', '/disponible?producto=no-existe')).json.disponible === false, 'producto desconocido no está disponible');
ok((await llamar('GET', '/disponible?producto=apagado')).json.disponible === false, 'producto apagado no está disponible');
ok((await llamar('GET', '/disponible?producto=x')).json.disponible === false, 'id de producto inválido');
token = '';
ok((await llamar('GET', '/disponible?producto=lo-tuyo-reporte')).json.disponible === false, 'sin clave de Mercado Pago no está disponible');
r = await llamar('POST', '/crear', { cuerpo: { producto: 'lo-tuyo-reporte', variante: 'unico', volver: 'https://lo-tuyo.netlify.app/' } });
ok(r.status === 503 && r.json.error === 'no_configurado', 'sin clave no se crean pagos');
token = TOKEN;
ok((await llamar('GET', '/nada')).status === 404, 'ruta inexistente');
ok((await llamar('GET', '/crear')).status === 404, 'crear solo por POST');

// Crear: validaciones
const crear = cuerpo => llamar('POST', '/crear', { cuerpo });
ok((await crear('no es json')).status === 400, 'cuerpo inválido');
ok((await crear({ producto: 'no-existe', variante: 'a', volver: 'https://x.com/' })).status === 404, 'producto inexistente');
ok((await crear({ producto: 'apagado', variante: 'x', volver: 'https://otro.example/' })).status === 404, 'producto apagado');
ok((await crear({ producto: 'buen-partido-reporte', variante: 'c', volver: 'https://buen-partido.netlify.app/' })).json.error === 'variante', 'variante que no existe');
ok((await crear({ producto: 'buen-partido-reporte', variante: 'a', volver: 'https://malo.com/' })).json.error === 'volver', 'vuelta a otro sitio');
ok((await crear({ producto: 'buen-partido-reporte', variante: 'a', volver: 'javascript:alert(1)' })).json.error === 'volver', 'vuelta con javascript:');
ok((await crear({ producto: 'buen-partido-reporte', variante: 'a', volver: 'https://user:pw@buen-partido.netlify.app/' })).json.error === 'volver', 'vuelta con credenciales');
ok((await crear({ producto: 'buen-partido-reporte', variante: 'a', cupon: 'NOEXISTE', volver: 'https://buen-partido.netlify.app/' })).json.error === 'cupon', 'cupón inexistente');
ok((await crear({ producto: 'buen-partido-reporte', variante: 'a', cupon: '<x>', volver: 'https://buen-partido.netlify.app/' })).json.error === 'cupon', 'cupón con caracteres raros');
ok(MP.prefs.length === 0, 'ninguna validación fallida llega a Mercado Pago');

// Crear: pedido válido con cupón y preferencia completa
r = await crear({ producto: 'buen-partido-reporte', variante: 'a', cupon: 'pata20', volver: 'https://buen-partido.netlify.app/?v=dolor#planes' });
ok(r.status === 200 && /^[a-f0-9]{24}$/.test(r.json.pedido) && r.json.url.startsWith('https://www.mercadopago.com.pe/') && r.json.monto === 31.2, 'pedido con cupón del 20%: ' + JSON.stringify(r.json));
const bp = r.json.pedido;
let pref = MP.prefs.at(-1);
ok(pref.items[0].unit_price === 31.2 && pref.items[0].currency_id === 'PEN' && pref.items[0].quantity === 1 && pref.items[0].title.includes('Buen Partido'), 'ítem con el monto del catálogo');
ok(pref.external_reference === bp && pref.idempotencia === bp, 'referencia e idempotencia con el número de pedido');
ok(pref.back_urls.success === `https://buen-partido.netlify.app/?v=dolor&pago=${bp}` && pref.back_urls.failure === pref.back_urls.success, 'vuelve a la misma página, sin el #, con ?pago=: ' + pref.back_urls.success);
ok(pref.auto_return === 'approved' && pref.binary_mode === true && pref.notification_url === BASE + '/aviso', 'regreso automático, aprobación inmediata y aviso a la función');
ok(pref.statement_descriptor === 'BUENPARTIDO' && pref.payment_methods.installments === 1 && pref.payment_methods.excluded_payment_types.map(x => x.id).join() === 'ticket,atm', 'un solo pago con tarjeta y nombre en el estado de cuenta');
ok(tienda.db.pedidos.get(bp).cupon === 'PATA20' && tienda.db.pedidos.get(bp).monto === 31.2, 'el pedido guarda cupón y monto');
r = await crear({ producto: 'pidelo-bien-kit', variante: 'p4990', volver: 'https://deploy-preview-12--pidelo-bien.netlify.app/' });
ok(r.status === 200 && r.json.monto === 49.9, 'vista previa de Netlify autorizada con comodín');
ok((await crear({ producto: 'pidelo-bien-kit', variante: 'p4990', volver: 'https://a.b--pidelo-bien.netlify.app/' })).json.error === 'volver', 'el comodín no cruza puntos');
MP.caido = true;
r = await crear({ producto: 'lo-tuyo-reporte', variante: 'unico', volver: 'https://lo-tuyo.netlify.app/' });
ok(r.status === 502 && r.json.error === 'pasarela', 'Mercado Pago caído al crear');
MP.caido = false;

// Estado: de creado a pagado, con código una sola vez
ok((await llamar('GET', '/estado?pedido=zzz')).status === 400, 'número de pedido inválido');
ok((await llamar('GET', '/estado?pedido=' + 'a'.repeat(24))).status === 404, 'pedido inexistente');
r = await llamar('GET', '/estado?pedido=' + bp);
ok(r.status === 200 && r.json.estado === 'creado' && !r.json.codigo, 'sin pago aún');
pagar(bp, 39);   // monto sin el descuento: no coincide
r = await llamar('GET', '/estado?pedido=' + bp);
ok(r.json.estado === 'revisar' && !r.json.codigo, 'pago por otro monto queda en revisión');
MP.pagos.length = 0;
MP.pagos.push({ id: 5001, external_reference: bp, status: 'in_process', currency_id: 'PEN', transaction_amount: 31.2 });
ok((await llamar('GET', '/estado?pedido=' + bp)).json.estado === 'pendiente', 'pago en proceso');
MP.pagos.length = 0;
MP.pagos.push({ id: 5002, external_reference: bp, status: 'rejected', currency_id: 'PEN', transaction_amount: 31.2 });
ok((await llamar('GET', '/estado?pedido=' + bp)).json.estado === 'rechazado', 'pago rechazado');
pagar(bp, 31.2);
const [e1, e2] = await Promise.all([llamar('GET', '/estado?pedido=' + bp), llamar('GET', '/estado?pedido=' + bp)]);
ok(e1.json.estado === 'pagado' && /^BP-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(e1.json.codigo), 'pagado con código BP: ' + JSON.stringify(e1.json));
ok(e1.json.codigo === e2.json.codigo, 'dos consultas a la vez reciben el mismo código');
const codigoBP = e1.json.codigo;
const llamadasAntes = MP.llamadas;
r = await llamar('GET', '/estado?pedido=' + bp);
ok(r.json.codigo === codigoBP && MP.llamadas === llamadasAntes, 'un pedido pagado responde sin volver a consultar a Mercado Pago');
ok(tienda.db.pedidos.get(bp).estado === 'pagado' && tienda.db.pedidos.get(bp).pago === '9001', 'queda el pago aprobado');
token = '';
ok((await llamar('GET', '/estado?pedido=' + bp)).json.codigo === codigoBP, 'sin clave, un pedido pagado sigue entregando su código');
token = TOKEN;

// Códigos de acceso
const codigo = cuerpo => llamar('POST', '/codigo', { cuerpo });
ok((await codigo({ codigo: codigoBP, producto: 'buen-partido-reporte' })).json.ok === true, 'código válido');
ok((await codigo({ codigo: ' ' + codigoBP.toLowerCase().replace(/-/g, '-') + ' ', producto: 'buen-partido-reporte' })).json.ok === true, 'código en minúsculas y con espacios');
ok((await codigo({ codigo: codigoBP, producto: 'lo-tuyo-reporte' })).status === 404, 'un código de Buen Partido no abre Lo Tuyo');
ok((await codigo({ codigo: 'BP-AAAA-AAAA', producto: 'buen-partido-reporte' })).status === 404, 'código inventado');
ok((await codigo({ codigo: 'nada', producto: 'buen-partido-reporte' })).status === 400, 'código con mal formato');
ok((await codigo({ codigo: codigoBP })).status === 400, 'código sin producto');

// Aviso de Mercado Pago (webhook) y devoluciones
r = await crear({ producto: 'lo-tuyo-reporte', variante: 'unico', volver: 'https://lo-tuyo.netlify.app/' });
const lt = r.json.pedido;
ok(MP.prefs.at(-1).statement_descriptor === 'PORTUGALRI' && MP.prefs.at(-1).items[0].title === 'Reporte personalizado', 'Lo Tuyo cobra con nombre neutro');
const idLT = pagar(lt, 39);
ok((await llamar('POST', '/aviso?type=payment&data.id=' + idLT, { cuerpo: { type: 'payment', data: { id: String(idLT) } } })).status === 200, 'aviso aceptado');
ok(tienda.db.pedidos.get(lt).estado === 'pagado' && /^LT-/.test(tienda.db.pedidos.get(lt).codigo), 'el aviso marca el pedido como pagado aunque nadie haya vuelto a la página');
const codigoLT = tienda.db.pedidos.get(lt).codigo;
ok((await llamar('GET', '/estado?pedido=' + lt)).json.codigo === codigoLT, 'al volver recibe el código que dejó el aviso');
ok((await llamar('POST', '/aviso?topic=merchant_order&id=123')).status === 200 && MP.llamadas > 0, 'otros avisos se ignoran');
ok((await llamar('POST', '/aviso', { cuerpo: { type: 'payment', data: { id: '999999' } } })).status === 500, 'pago desconocido: error para que Mercado Pago reintente');
MP.pagos.find(p => p.id === idLT).status = 'refunded';
ok((await llamar('POST', '/aviso', { cuerpo: { type: 'payment', data: { id: String(idLT) } } })).status === 200, 'aviso de devolución');
ok(tienda.db.pedidos.get(lt).estado === 'devuelto', 'pedido devuelto');
ok((await codigo({ codigo: codigoLT, producto: 'lo-tuyo-reporte' })).status === 404, 'el código de una compra devuelta deja de abrir');
ok((await llamar('GET', '/estado?pedido=' + lt)).json.estado === 'devuelto', 'el estado informa la devolución');

// Cupones
ok((await llamar('GET', '/cupon?producto=buen-partido-reporte&cupon=pata20')).json.descuento === 20, 'cupón válido');
ok((await llamar('GET', '/cupon?producto=lo-tuyo-reporte&cupon=PATA20')).status === 404, 'el cupón es solo de su producto');

// Libro de Reclamaciones
const hoja = { sitio: 'lo-tuyo', nombre: 'Ana Pérez', tipo_documento: 'DNI', documento: '12345678', domicilio: 'Av. Siempre Viva 123', email: 'ana@correo.pe', bien: 'Servicio', tipo: 'reclamo', detalle: 'No pude descargar el reporte.', pedido: 'Que me lo envíen.' };
ok((await llamar('POST', '/reclamo', { cuerpo: { ...hoja, email: 'malo' } })).status === 400, 'reclamo con correo inválido');
ok((await llamar('POST', '/reclamo', { cuerpo: { ...hoja, menor: true } })).status === 400, 'menor sin apoderado');
ok((await llamar('POST', '/reclamo', { cuerpo: { ...hoja, sitio: 'pidelo-bien' } })).status === 400, 'Pídelo Bien tiene su propio libro');
r = await llamar('POST', '/reclamo', { cuerpo: { ...hoja, extra: '<script>' }, ip: '2.2.2.2' });
const anio = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 4);
ok(r.json.ok && r.json.numero === `000001-${anio}`, 'primera hoja de Lo Tuyo: ' + JSON.stringify(r.json));
ok(!('extra' in tienda.db.reclamos[0].datos) && tienda.db.reclamos[0].datos.menor === false, 'solo se guardan los campos del formulario');
ok((await llamar('POST', '/reclamo', { cuerpo: hoja, ip: '2.2.2.2' })).json.numero === `000002-${anio}`, 'número correlativo');
ok((await llamar('POST', '/reclamo', { cuerpo: { ...hoja, sitio: 'buen-partido' }, ip: '2.2.2.2' })).json.numero === `000001-${anio}`, 'cada página numera sus hojas');
for (let i = 0; i < 2; i++) await llamar('POST', '/reclamo', { cuerpo: hoja, ip: '2.2.2.2' });
ok((await llamar('POST', '/reclamo', { cuerpo: hoja, ip: '2.2.2.2' })).status === 429, 'límite de hojas por IP');

// Panel
ok((await llamar('GET', '/resumen')).status === 401, 'resumen sin token');
ok((await llamar('GET', '/resumen', { panel: 'otro' })).status === 401, 'resumen con token equivocado');
r = await llamar('GET', '/resumen', { panel: PANEL });
ok(r.status === 200 && r.json.mercado_pago === true && r.json.ventas.total === 1 && r.json.ventas.monto === 31.2, 'ventas totales: ' + JSON.stringify(r.json.ventas));
ok(r.json.ventas.por_producto['buen-partido-reporte'].por_variante.a.ventas === 1 && r.json.ventas.por_producto['lo-tuyo-reporte'].ventas === 0, 'ventas por producto y variante (la devuelta no cuenta)');
ok(Object.keys(r.json.ventas.por_producto['buen-partido-reporte'].por_dia).length === 1, 'ventas por día');
ok(r.json.pedidos_30_dias['lo-tuyo-reporte'].devuelto === 1 && r.json.pedidos_30_dias['buen-partido-reporte'].pagado === 1, 'pedidos del mes por estado');
ok(r.json.reclamos.length === 5 && r.json.reclamos[0].datos.nombre === 'Ana Pérez', 'el panel ve las hojas');
ok((await llamar('POST', '/reclamo/respondido', { panel: PANEL, cuerpo: { id: 1 } })).json.ok && tienda.db.reclamos[0].respondido, 'marcar hoja respondida');
ok((await llamar('POST', '/reclamo/respondido', { cuerpo: { id: 1 } })).status === 401, 'marcar respondida pide token');

// Límite de pagos por IP
ipActual = '3.3.3.3';
let ultimo;
for (let i = 0; i < 31; i++) ultimo = await crear({ producto: 'pidelo-bien-kit', variante: 'p2990', volver: 'https://pidelo-bien.netlify.app/' });
ok(ultimo.status === 429, 'límite de pagos creados por IP');

// Utilidades
const muestras = Array.from({ length: 300 }, () => nuevoCodigo('PB'));
ok(muestras.every(c => /^PB-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/.test(c)) && new Set(muestras).size === 300, 'códigos legibles y distintos');
ok(await huellaCodigo('pb-abcd-efgh ') === await huellaCodigo('PB-ABCD-EFGH'), 'la huella no distingue mayúsculas ni espacios');
ok(origenPermitido('https://abc--lo-tuyo.netlify.app', ['https://*--lo-tuyo.netlify.app']) && !origenPermitido('https://lo-tuyo.netlify.app.malo.com', ['https://lo-tuyo.netlify.app']), 'orígenes permitidos');
ok(urlDeVuelta('https://lo-tuyo.netlify.app/?pago=viejo', PRODUCTOS[2], 'p1') === 'https://lo-tuyo.netlify.app/?pago=p1', 'reemplaza un ?pago= anterior');

console.log(`Cobros: ${checks - failures}/${checks} verificaciones OK`);
if (failures) process.exit(1);
