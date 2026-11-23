// Cobros: la lógica del servicio, sin depender del entorno. Corre igual en Supabase (Deno) y en las pruebas (Node).
// Rutas (todas bajo /functions/v1/cobros):
//   GET  /disponible?producto=     ¿se puede pagar con tarjeta? (hay clave de Mercado Pago y el producto está activo)
//   GET  /cupon?producto=&cupon=   valida un cupón de descuento
//   POST /crear                    crea el pedido y devuelve el enlace de pago de Mercado Pago
//   GET  /estado?pedido=           confirma el pago con Mercado Pago; si está pagado, entrega el código de acceso
//   POST /aviso                    aviso de Mercado Pago (webhook)
//   POST /codigo                   valida un código de acceso en otro equipo
//   POST /reclamo                  registra una hoja del Libro de Reclamaciones (Lo Tuyo, Buen Partido y Buen Ojo)
//   GET  /resumen                  panel: ventas, pedidos y reclamos (cabecera x-panel con el token)
//   POST /reclamo/respondido       panel: marca una hoja como respondida
import { crearPreferencia, estadoEnMP, pedidoDePago } from './mp.js';

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sin 0, O, 1, I ni L: se dicta y se copia sin errores
export const PEDIDO = /^[a-f0-9]{24}$/;
const CODIGO = /^([A-Z]{2})-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const PRODUCTO = /^[a-z0-9-]{3,40}$/;
const VARIANTE = /^[a-z0-9]{1,20}$/;
const CUPON = /^[A-Z0-9]{3,30}$/;
const LIBROS = ['lo-tuyo', 'buen-partido', 'buen-ojo'];   // páginas cuyo Libro de Reclamaciones guarda este servicio

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
// El número de pedido es aleatorio y solo lo conoce el navegador que pagó: funciona como su llave
export const nuevoPedido = () => hex(crypto.getRandomValues(new Uint8Array(12)));
function letra() {
  const tope = 256 - (256 % LETRAS.length);   // sin sesgo: se descartan los bytes que no reparten parejo
  for (;;) {
    const b = crypto.getRandomValues(new Uint8Array(1))[0];
    if (b < tope) return LETRAS[b % LETRAS.length];
  }
}
const bloque = () => Array.from({ length: 4 }, letra).join('');
export const nuevoCodigo = prefijo => `${prefijo}-${bloque()}-${bloque()}`;
export const normalizarCodigo = c => String(c || '').toUpperCase().replace(/\s+/g, '');
export async function sha256(texto) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(texto)))));
}
export const huellaCodigo = c => sha256(normalizarCodigo(c));
const redondear = n => Math.round(n * 100) / 100;
// Perú no cambia de hora: UTC-5 todo el año
export const limaDia = (d = new Date()) => new Date(d.getTime() - 5 * 3600e3).toISOString().slice(0, 10);

// ¿El origen pertenece a una página autorizada del producto? Un * vale por un tramo de nombre (vistas previas).
export function origenPermitido(origen, patrones) {
  return (patrones || []).some(p => {
    const re = p.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[A-Za-z0-9-]+');
    return new RegExp(`^${re}$`).test(origen);
  });
}
// Dirección a la que Mercado Pago devuelve a quien paga: la página que pidió el pago, con ?pago=<pedido>
export function urlDeVuelta(volver, producto, pedido) {
  let u;
  try { u = new URL(String(volver || '')); } catch (e) { return null; }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
  if (!origenPermitido(u.origin, producto.origenes)) return null;
  u.hash = '';
  u.searchParams.set('pago', pedido);
  return u.toString();
}
// El monto sale del catálogo, nunca del navegador
export function montoDe(producto, variante, cupon) {
  const base = Number((producto.precios || {})[variante]);
  if (!(base > 0)) return { error: 'variante' };
  if (!cupon) return { monto: redondear(base) };
  const pct = Number((producto.cupones || {})[cupon]);
  if (!(pct > 0 && pct < 100)) return { error: 'cupon' };
  return { monto: redondear(base * (100 - pct) / 100), descuento: pct };
}

// Límite de solicitudes por IP, en memoria (vale por instancia de la función: frena abusos, no es contabilidad)
export function limitador(max, ventanaMs) {
  const m = new Map();
  return clave => {
    const ahora = Date.now();
    const e = m.get(clave);
    if (!e || ahora - e.t > ventanaMs) {
      if (m.size > 5000) m.clear();
      m.set(clave, { t: ahora, n: 1 });
      return true;
    }
    e.n += 1;
    return e.n <= max;
  };
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-panel',
  'Access-Control-Max-Age': '86400'
};
const responder = (status, data) => ({
  status,
  body: data === undefined ? null : JSON.stringify(data),
  headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
function leerJSON(texto, max) {
  if (!texto || texto.length > max) return null;
  try { const b = JSON.parse(texto); return b && typeof b === 'object' && !Array.isArray(b) ? b : null; } catch (e) { return null; }
}
const publico = p => {
  const o = { estado: p.estado, producto: p.producto, variante: p.variante, monto: Number(p.monto) };
  if (p.estado === 'pagado' && p.codigo) o.codigo = p.codigo;
  return o;
};

// Revisa el pedido con Mercado Pago y, si está pagado, deja su código una sola vez
export async function sincronizar(ctx, p, forzar = false) {
  if (p.estado === 'pagado' && p.codigo && !forzar) return p;
  const r = await estadoEnMP(ctx, p.id, Number(p.monto));
  if (r.estado === 'pagado') {
    if (p.estado === 'pagado' && p.codigo) return p;
    const prod = await ctx.tienda.producto(p.producto);
    let error;
    for (let i = 0; i < 3; i++) {   // un choque de huellas es casi imposible, pero si pasa se prueba otro código
      const codigo = nuevoCodigo(prod.prefijo);
      try {
        const final = await ctx.tienda.marcarPagado(p.id, r.pago, codigo, await huellaCodigo(codigo));
        return { ...p, estado: 'pagado', pago: r.pago, codigo: final };
      } catch (e) { error = e; }
    }
    throw error;
  }
  if (r.estado === 'devuelto') {
    if (p.estado !== 'devuelto') await ctx.tienda.marcarDevuelto(p.id);
    return { ...p, estado: 'devuelto', codigo: null };
  }
  if (p.estado === 'pagado') return p;   // la búsqueda de Mercado Pago puede tardar: un pago nunca retrocede
  if (r.estado !== p.estado) await ctx.tienda.actualizarEstado(p.id, r.estado);
  return { ...p, estado: r.estado };
}

const texto = (v, max, min = 1) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const opcional = (v, max) => v === undefined || v === null || v === '' || (typeof v === 'string' && v.length <= max);
export function validarReclamo(b) {
  if (!b || !LIBROS.includes(b.sitio)) return null;
  const ok = texto(b.nombre, 120, 3) && ['DNI', 'Carné de extranjería', 'Pasaporte'].includes(b.tipo_documento) &&
    texto(b.documento, 20, 4) && texto(b.domicilio, 200, 3) && opcional(b.telefono, 20) &&
    /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(b.email || '')) && String(b.email).length <= 120 &&
    ['Servicio', 'Producto'].includes(b.bien) && opcional(b.descripcion, 200) && opcional(b.monto, 12) &&
    ['reclamo', 'queja'].includes(b.tipo) && texto(b.detalle, 4000, 5) && texto(b.pedido, 2000, 3) &&
    opcional(b.apoderado, 120) && (!b.menor || texto(b.apoderado, 120, 3)) && opcional(b.compra, 40);
  if (!ok) return null;
  const limpio = {};
  for (const k of ['nombre', 'tipo_documento', 'documento', 'domicilio', 'telefono', 'email', 'apoderado', 'bien', 'descripcion', 'monto', 'tipo', 'detalle', 'pedido', 'compra']) {
    if (typeof b[k] === 'string' && b[k].trim()) limpio[k] = b[k].trim();
  }
  limpio.menor = !!b.menor;
  return limpio;
}

async function resumen(ctx) {
  const ahora = ctx.ahora();
  const desde30 = new Date(ahora.getTime() - 30 * 86400e3).toISOString();
  const [productos, pagados, recientes, reclamos] = await Promise.all([
    ctx.tienda.productos(), ctx.tienda.pagados(), ctx.tienda.recientes(desde30), ctx.tienda.reclamos()
  ]);
  const limite90 = limaDia(new Date(ahora.getTime() - 89 * 86400e3));
  const ventas = { total: 0, monto: 0, por_producto: {} };
  for (const pr of productos) ventas.por_producto[pr.id] = { sitio: pr.sitio, ventas: 0, monto: 0, por_variante: {}, por_dia: {} };
  for (const p of pagados) {
    const v = ventas.por_producto[p.producto];
    if (!v) continue;
    const m = Number(p.monto);
    ventas.total += 1; ventas.monto = redondear(ventas.monto + m);
    v.ventas += 1; v.monto = redondear(v.monto + m);
    const pv = v.por_variante[p.variante] = v.por_variante[p.variante] || { ventas: 0, monto: 0 };
    pv.ventas += 1; pv.monto = redondear(pv.monto + m);
    const dia = limaDia(new Date(p.pagado));
    if (dia >= limite90) {
      const pd = v.por_dia[dia] = v.por_dia[dia] || { ventas: 0, monto: 0 };
      pd.ventas += 1; pd.monto = redondear(pd.monto + m);
    }
  }
  const pedidos30 = {};
  for (const p of recientes) {
    const e = pedidos30[p.producto] = pedidos30[p.producto] || {};
    e[p.estado] = (e[p.estado] || 0) + 1;
  }
  return {
    generado: ahora.toISOString(),
    productos: productos.map(p => ({ id: p.id, sitio: p.sitio, nombre: p.nombre, precios: p.precios, activo: p.activo })),
    mercado_pago: !!ctx.token,
    ventas,
    pedidos_30_dias: pedidos30,
    reclamos: reclamos.map(r => ({ id: r.id, sitio: r.sitio, numero: r.numero, creado: r.creado, respondido: r.respondido, datos: r.datos }))
  };
}

// req: { method, url (URL), texto, ip, panel }. ctx: { tienda, token, base, fetch, limite, ahora, log }
export async function atender(req, ctx) {
  if (req.method === 'OPTIONS') return { status: 204, body: null, headers: CORS };
  const ruta = req.url.pathname.replace(/^.*?\/cobros(?=\/|$)/, '').replace(/\/+$/, '') || '/';
  const q = req.url.searchParams;
  const limite = (tipo, max) => ctx.limite(`${tipo}:${req.ip || '?'}`, max);

  if (ruta === '/disponible' && req.method === 'GET') {
    const id = q.get('producto') || '';
    const p = PRODUCTO.test(id) ? await ctx.tienda.producto(id) : null;
    return responder(200, { disponible: !!(ctx.token && p && p.activo) });
  }

  if (ruta === '/cupon' && req.method === 'GET') {
    if (!limite('cupon', 30)) return responder(429, { error: 'espera' });
    const id = q.get('producto') || '', cupon = normalizarCodigo(q.get('cupon'));
    const p = PRODUCTO.test(id) && CUPON.test(cupon) ? await ctx.tienda.producto(id) : null;
    const pct = p ? Number((p.cupones || {})[cupon]) : 0;
    return pct > 0 && pct < 100 ? responder(200, { ok: true, descuento: pct }) : responder(404, { ok: false });
  }

  if (ruta === '/crear' && req.method === 'POST') {
    if (!ctx.token) return responder(503, { error: 'no_configurado' });
    if (!limite('crear', 30)) return responder(429, { error: 'espera' });
    const b = leerJSON(req.texto, 2048);
    if (!b || !PRODUCTO.test(String(b.producto || ''))) return responder(400, { error: 'producto' });
    const p = await ctx.tienda.producto(b.producto);
    if (!p || !p.activo) return responder(404, { error: 'producto' });
    const variante = String(b.variante || '');
    if (!VARIANTE.test(variante)) return responder(400, { error: 'variante' });
    const cupon = b.cupon ? normalizarCodigo(b.cupon) : '';
    if (cupon && !CUPON.test(cupon)) return responder(400, { error: 'cupon' });
    const m = montoDe(p, variante, cupon);
    if (m.error) return responder(400, { error: m.error });
    const pedido = nuevoPedido();
    const vuelta = urlDeVuelta(b.volver, p, pedido);
    if (!vuelta) return responder(400, { error: 'volver' });
    await ctx.tienda.crearPedido({ id: pedido, producto: p.id, variante, cupon: cupon || null, monto: m.monto });
    try {
      const url = await crearPreferencia(ctx, { pedido, producto: p, monto: m.monto, vuelta });
      return responder(200, { pedido, url, monto: m.monto });
    } catch (e) {
      ctx.log('crear pago:', e.message);
      return responder(502, { error: 'pasarela' });
    }
  }

  if (ruta === '/estado' && req.method === 'GET') {
    const id = q.get('pedido') || '';
    if (!PEDIDO.test(id)) return responder(400, { error: 'pedido' });
    const p = await ctx.tienda.pedido(id);
    if (!p) return responder(404, { error: 'pedido' });
    if ((p.estado === 'pagado' && p.codigo) || !ctx.token) return responder(200, publico(p));
    try {
      return responder(200, publico(await sincronizar(ctx, p)));
    } catch (e) {
      ctx.log('estado de pago:', e.message);
      return responder(502, { error: 'pasarela' });
    }
  }

  if (ruta === '/aviso' && req.method === 'POST') {
    // Mercado Pago avisa con ?data.id=…&type=payment (webhook) o ?id=…&topic=payment (IPN). Lo demás se ignora.
    const b = leerJSON(req.texto, 16384) || {};
    const tipo = q.get('type') || q.get('topic') || b.type || b.topic || '';
    const id = String(q.get('data.id') || (b.data && b.data.id) || (tipo === 'payment' ? q.get('id') : '') || '');
    if (!ctx.token || tipo !== 'payment' || !/^\d{1,20}$/.test(id)) return { status: 200, body: null, headers: CORS };
    try {
      const pedido = await pedidoDePago(ctx, id);
      const p = pedido ? await ctx.tienda.pedido(pedido) : null;
      if (p) await sincronizar(ctx, p, true);
      return { status: 200, body: null, headers: CORS };
    } catch (e) {
      ctx.log('aviso de pago:', e.message);
      return { status: 500, body: null, headers: CORS };   // Mercado Pago lo reintenta
    }
  }

  if (ruta === '/codigo' && req.method === 'POST') {
    if (!limite('codigo', 20)) return responder(429, { ok: false, error: 'espera' });
    const b = leerJSON(req.texto, 512);
    const codigo = normalizarCodigo(b && b.codigo);
    const m = CODIGO.exec(codigo);
    if (!b || !m || !PRODUCTO.test(String(b.producto || ''))) return responder(400, { ok: false });
    const p = await ctx.tienda.producto(b.producto);
    if (!p || p.prefijo !== m[1]) return responder(404, { ok: false });
    const ok = await ctx.tienda.acceso(await huellaCodigo(codigo), p.id);
    return responder(ok ? 200 : 404, { ok });
  }

  if (ruta === '/reclamo' && req.method === 'POST') {
    if (!limite('reclamo', 5)) return responder(429, { ok: false, error: 'espera' });
    const b = leerJSON(req.texto, 16000);
    const datos = validarReclamo(b);
    if (!datos) return responder(400, { ok: false, error: 'datos_incompletos' });
    const r = await ctx.tienda.registrarReclamo(b.sitio, datos);
    return responder(200, { ok: true, numero: r.hoja, fecha: r.fecha });
  }

  if (ruta === '/resumen' || ruta === '/reclamo/respondido') {
    if (!limite('panel', 30)) return responder(429, { error: 'espera' });
    const huella = await ctx.tienda.config('panel_huella');
    if (!huella || !req.panel || (await sha256(req.panel)) !== huella) return responder(401, { error: 'token' });
    if (ruta === '/resumen' && req.method === 'GET') return responder(200, await resumen(ctx));
    if (ruta === '/reclamo/respondido' && req.method === 'POST') {
      const b = leerJSON(req.texto, 256);
      if (!b || !Number.isInteger(b.id) || b.id < 1) return responder(400, { error: 'id' });
      await ctx.tienda.marcarRespondido(b.id);
      return responder(200, { ok: true });
    }
  }
  return responder(404, { error: 'ruta' });
}
