// Cobro con tarjeta (Mercado Pago Checkout Pro): crea el pago, confirma el resultado con Mercado Pago,
// emite un código de acceso por compra y valida códigos. Sin MP_ACCESS_TOKEN el cobro figura como no disponible.
import { getStore } from '@netlify/blobs';
import { json, leerJSON, limaDia } from '../lib/comun.mjs';
import { PEDIDO, crearPreferencia, estadoEnMP, huellaCodigo, normalizarCodigo, nuevoCodigo, nuevoPedido, pedidoDePago, precioDe } from '../lib/pagos.mjs';

const ID = /^[a-z0-9]{6,16}$/;
const CODIGO = /^PB-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// Revisa el pedido con Mercado Pago y, si está pagado, emite su código una sola vez
async function sincronizar(token, pedido) {
  const store = getStore('pagos');
  const p = await store.get(`pedidos/${pedido}`, { type: 'json' });
  if (!p || p.estado === 'pagado') return p;
  const r = await estadoEnMP(token, pedido, p.precio);
  if (r.estado !== 'pagado') {
    if (r.estado !== p.estado) { p.estado = r.estado; await store.setJSON(`pedidos/${pedido}`, p); }
    return p;
  }
  const ahora = new Date();
  let codigo = nuevoCodigo();
  const { modified } = await store.setJSON(`emitidos/${pedido}`, { codigo }, { onlyIfNew: true });
  if (modified) {
    await store.setJSON(`accesos/${huellaCodigo(codigo)}`, { pedido, creado: ahora.toISOString() });
    await store.set(`pagados/${limaDia(ahora)}/${pedido}~${p.variante}`, '1');
    if (ID.test(p.sesion || '')) await getStore('eventos').set(`${limaDia(ahora)}/${p.sesion}/${ahora.getTime().toString(36)}zz~paid~${p.variante}`, '1');
  } else {
    // Otro aviso llegó primero: vale el código que ya se emitió
    for (let i = 0; i < 3; i++) {
      const e = await store.get(`emitidos/${pedido}`, { type: 'json' });
      if (e && e.codigo) { codigo = e.codigo; break; }
      await new Promise(res => setTimeout(res, 300));
    }
  }
  Object.assign(p, { estado: 'pagado', codigo, pago: r.pago, pagado: ahora.toISOString() });
  await store.setJSON(`pedidos/${pedido}`, p);
  return p;
}

export default async req => {
  const url = new URL(req.url);
  const ruta = url.pathname;
  const token = Netlify.env.get('MP_ACCESS_TOKEN');

  // Códigos de acceso emitidos por compra (los manuales siguen validándose en el navegador)
  if (ruta === '/api/codigo') {
    if (req.method !== 'POST') return json({ ok: false }, 405);
    const codigo = normalizarCodigo(((await leerJSON(req, 512)) || {}).codigo);
    if (!CODIGO.test(codigo)) return json({ ok: false }, 400);
    const acceso = await getStore('pagos').get(`accesos/${huellaCodigo(codigo)}`, { type: 'json' });
    return json({ ok: !!acceso }, acceso ? 200 : 404);
  }
  if (ruta === '/api/pago/disponible') return json({ disponible: !!token });
  if (!token) return json({ error: 'no_configurado' }, 503);

  if (ruta === '/api/pago/crear') {
    if (req.method !== 'POST') return json({ error: 'metodo' }, 405);
    const b = (await leerJSON(req, 512)) || {};
    const precio = precioDe(String(b.variante || ''));
    if (!precio) return json({ error: 'variante' }, 400);
    const pedido = nuevoPedido();
    await getStore('pagos').setJSON(`pedidos/${pedido}`, {
      estado: 'creado', variante: b.variante, precio, sesion: ID.test(String(b.s || '')) ? b.s : '', creado: new Date().toISOString()
    });
    try {
      return json({ pedido, url: await crearPreferencia(token, { pedido, precio, sitio: url.origin }) });
    } catch (e) {
      console.error('crear pago:', e.message);
      return json({ error: 'pasarela' }, 502);
    }
  }

  if (ruta === '/api/pago/estado') {
    const pedido = url.searchParams.get('pedido') || '';
    if (!PEDIDO.test(pedido)) return json({ error: 'pedido' }, 400);
    try {
      const p = await sincronizar(token, pedido);
      if (!p) return json({ error: 'pedido' }, 404);
      return json(p.estado === 'pagado' ? { estado: 'pagado', codigo: p.codigo } : { estado: p.estado });
    } catch (e) {
      console.error('estado de pago:', e.message);
      return json({ error: 'pasarela' }, 502);
    }
  }

  if (ruta === '/api/pago/aviso') {
    // Mercado Pago avisa con ?data.id=…&type=payment (webhook) o ?id=…&topic=payment (IPN). Lo demás se ignora.
    const b = req.method === 'POST' ? (await leerJSON(req, 8192)) || {} : {};
    const tipo = url.searchParams.get('type') || url.searchParams.get('topic') || b.type || '';
    const id = String(url.searchParams.get('data.id') || (b.data && b.data.id) || (tipo === 'payment' ? url.searchParams.get('id') : '') || '');
    if (tipo !== 'payment' || !/^\d{1,20}$/.test(id)) return new Response(null, { status: 200 });
    try {
      const pedido = await pedidoDePago(token, id);
      if (pedido) await sincronizar(token, pedido);
      return new Response(null, { status: 200 });
    } catch (e) {
      console.error('aviso de pago:', e.message);
      return new Response(null, { status: 500 });   // Mercado Pago lo reintenta
    }
  }
  return json({ error: 'ruta' }, 404);
};

export const config = {
  path: ['/api/pago/disponible', '/api/pago/crear', '/api/pago/estado', '/api/pago/aviso', '/api/codigo'],
  method: ['GET', 'POST']
};
