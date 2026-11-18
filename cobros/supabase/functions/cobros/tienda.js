// Acceso a las tablas cb_* por la API REST del proyecto, con la clave secreta (pasa por encima de RLS).
// Sin dependencias: solo fetch. Cada método lanza un error si la base responde con error.
export function tiendaSupabase({ url, clave, fetch }) {
  const base = url.replace(/\/+$/, '') + '/rest/v1/';
  // Las claves nuevas (sb_secret_…) van solo en apikey; las antiguas (JWT) también en Authorization
  const cabeceras = extra => ({
    apikey: clave, 'Content-Type': 'application/json',
    ...(clave.startsWith('eyJ') ? { Authorization: `Bearer ${clave}` } : {}), ...(extra || {})
  });
  async function q(ruta, opts = {}) {
    const r = await fetch(base + ruta, { ...opts, headers: cabeceras(opts.headers) });
    const texto = await r.text();
    if (!r.ok) throw new Error(`Base de datos ${r.status}: ${texto.slice(0, 200)}`);
    return texto ? JSON.parse(texto) : null;
  }
  const uno = filas => (Array.isArray(filas) && filas.length ? filas[0] : null);
  const enc = encodeURIComponent;
  const post = (ruta, cuerpo, prefer) => q(ruta, { method: 'POST', body: JSON.stringify(cuerpo), headers: prefer ? { Prefer: prefer } : {} });
  const patch = (ruta, cuerpo) => q(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo), headers: { Prefer: 'return=minimal' } });
  return {
    producto: async id => uno(await q(`cb_productos?id=eq.${enc(id)}&select=*`)),
    productos: () => q('cb_productos?select=id,sitio,nombre,precios,activo&order=sitio.asc'),
    pedido: async id => uno(await q(`cb_pedidos?id=eq.${enc(id)}&select=*`)),
    crearPedido: fila => post('cb_pedidos', fila, 'return=minimal'),
    // Nunca retrocede un pedido pagado
    actualizarEstado: (id, estado) => patch(`cb_pedidos?id=eq.${enc(id)}&estado=neq.pagado`, { estado, actualizado: new Date().toISOString() }),
    marcarPagado: (pedido, pago, codigo, huella) => post('rpc/cb_marcar_pagado', { p_pedido: pedido, p_pago: pago, p_codigo: codigo, p_huella: huella }),
    marcarDevuelto: pedido => post('rpc/cb_marcar_devuelto', { p_pedido: pedido }),
    acceso: async (huella, producto) => !!uno(await q(`cb_accesos?huella=eq.${enc(huella)}&producto=eq.${enc(producto)}&select=pedido`)),
    config: async clave => { const f = uno(await q(`cb_config?clave=eq.${enc(clave)}&select=valor`)); return f ? f.valor : null; },
    pagados: () => q('cb_pedidos?estado=eq.pagado&select=producto,variante,cupon,monto,pagado&order=pagado.desc&limit=10000'),
    recientes: desde => q(`cb_pedidos?creado=gte.${enc(desde)}&select=producto,estado&limit=20000`),
    registrarReclamo: async (sitio, datos) => uno(await post('rpc/cb_registrar_reclamo', { p_sitio: sitio, p_datos: datos })),
    reclamos: () => q('cb_reclamos?select=id,sitio,numero,creado,datos,respondido&order=creado.desc&limit=500'),
    marcarRespondido: id => patch(`cb_reclamos?id=eq.${Number(id)}`, { respondido: new Date().toISOString() })
  };
}
