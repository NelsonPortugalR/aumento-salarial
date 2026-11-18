// Cliente mínimo de Mercado Pago (Checkout Pro). La clave vive en el secreto MP_ACCESS_TOKEN de la función.
// Un pago solo se da por bueno cuando Mercado Pago lo confirma al consultarlo con esa clave: ni el aviso
// ni el regreso del comprador bastan por sí solos, así que no se pueden falsificar.
const API = 'https://api.mercadopago.com';

async function mp(ctx, ruta, opts = {}) {
  const r = await ctx.fetch(API + ruta, {
    ...opts,
    headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${body.message || body.error || 'sin detalle'}`);
  return body;
}

export async function crearPreferencia(ctx, { pedido, producto, monto, vuelta }) {
  const pref = await mp(ctx, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': pedido },
    body: JSON.stringify({
      items: [{ id: producto.id, title: producto.nombre, quantity: 1, unit_price: monto, currency_id: 'PEN' }],
      external_reference: pedido,
      back_urls: { success: vuelta, failure: vuelta, pending: vuelta },
      auto_return: 'approved',
      notification_url: `${ctx.base}/aviso`,
      statement_descriptor: producto.descriptor,
      binary_mode: true,   // aprobado o rechazado al instante: lo comprado se desbloquea al volver
      payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }], installments: 1 }
    })
  });
  if (!pref.init_point) throw new Error('Mercado Pago no devolvió el enlace de pago');
  return pref.init_point;
}

// Estado del pedido según Mercado Pago: pagado solo si hay un pago aprobado en soles por el monto exacto
export async function estadoEnMP(ctx, pedido, monto) {
  const r = await mp(ctx, `/v1/payments/search?external_reference=${pedido}&sort=date_created&criteria=desc&limit=20`);
  const pagos = (r.results || []).filter(p => p.external_reference === pedido);
  const exacto = p => p.currency_id === 'PEN' && Math.abs(Number(p.transaction_amount) - monto) < 0.005;
  const ok = pagos.find(p => p.status === 'approved' && exacto(p));
  if (ok) return { estado: 'pagado', pago: String(ok.id) };
  if (pagos.some(p => ['refunded', 'charged_back'].includes(p.status) && exacto(p))) return { estado: 'devuelto' };
  if (pagos.some(p => ['pending', 'in_process', 'authorized'].includes(p.status))) return { estado: 'pendiente' };
  if (pagos.length && pagos.every(p => ['rejected', 'cancelled'].includes(p.status))) return { estado: 'rechazado' };
  // Aprobado por otro monto o en otra moneda: no desbloquea y lo revisa una persona en Mercado Pago
  if (pagos.length) return { estado: 'revisar' };
  return { estado: 'creado' };
}

export async function pedidoDePago(ctx, id) {
  const p = await mp(ctx, `/v1/payments/${encodeURIComponent(id)}`);
  const ref = String((p && p.external_reference) || '');
  return /^[a-f0-9]{24}$/.test(ref) ? ref : null;
}
