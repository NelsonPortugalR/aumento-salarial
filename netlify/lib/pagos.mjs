// Cobro con tarjeta vía Mercado Pago Checkout Pro. La clave vive en la variable MP_ACCESS_TOKEN de Netlify.
// Un pago solo se da por bueno cuando Mercado Pago lo confirma al consultarlo con esa clave: ni el aviso
// ni el regreso del comprador bastan por sí solos, así que no se pueden falsificar.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { VARIANTES } from './catalogos.mjs';

const API = 'https://api.mercadopago.com';
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sin 0, O, 1, I ni L: se dicta y se copia sin errores

export const PEDIDO = /^[a-f0-9]{24}$/;
// El número de pedido es aleatorio y solo lo conoce el navegador que pagó: funciona como su llave
export const nuevoPedido = () => randomBytes(12).toString('hex');
const bloque = () => Array.from({ length: 4 }, () => LETRAS[randomInt(LETRAS.length)]).join('');
export const nuevoCodigo = () => `PB-${bloque()}-${bloque()}`;
export const normalizarCodigo = c => String(c || '').toUpperCase().replace(/\s+/g, '');
export const huellaCodigo = c => createHash('sha256').update(normalizarCodigo(c)).digest('hex');
// El precio sale de la variante, nunca del navegador
export const precioDe = v => VARIANTES.includes(v) ? Number(v.slice(1)) / 100 : null;

async function mp(token, ruta, opts = {}) {
  const r = await fetch(API + ruta, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${body.message || body.error || 'sin detalle'}`);
  return body;
}

export async function crearPreferencia(token, { pedido, precio, sitio }) {
  const vuelta = `${sitio}/?pago=${pedido}`;
  const pref = await mp(token, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': pedido },
    body: JSON.stringify({
      items: [{ id: 'kit', title: 'Kit para negociar tu sueldo (Pídelo Bien)', quantity: 1, unit_price: precio, currency_id: 'PEN' }],
      external_reference: pedido,
      back_urls: { success: vuelta, failure: vuelta, pending: vuelta },
      auto_return: 'approved',
      notification_url: `${sitio}/api/pago/aviso`,
      statement_descriptor: 'PIDELOBIEN',
      binary_mode: true,   // aprobado o rechazado al instante: el kit se desbloquea al volver
      payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }], installments: 1 }
    })
  });
  if (!pref.init_point) throw new Error('Mercado Pago no devolvió el enlace de pago');
  return pref.init_point;
}

// Estado del pedido según Mercado Pago: pagado solo si hay un pago aprobado en soles por el monto exacto
export async function estadoEnMP(token, pedido, precio) {
  const r = await mp(token, `/v1/payments/search?external_reference=${pedido}&sort=date_created&criteria=desc&limit=20`);
  const pagos = (r.results || []).filter(p => p.external_reference === pedido);
  const ok = pagos.find(p => p.status === 'approved' && p.currency_id === 'PEN' && Math.abs(Number(p.transaction_amount) - precio) < 0.005);
  if (ok) return { estado: 'pagado', pago: String(ok.id) };
  if (pagos.some(p => ['pending', 'in_process', 'authorized'].includes(p.status))) return { estado: 'pendiente' };
  if (pagos.length && pagos.every(p => ['rejected', 'cancelled'].includes(p.status))) return { estado: 'rechazado' };
  // Aprobado por otro monto, devuelto o contracargado: no desbloquea y lo revisa una persona en Mercado Pago
  if (pagos.length) return { estado: 'revisar' };
  return { estado: 'creado' };
}

export async function pedidoDePago(token, id) {
  const p = await mp(token, `/v1/payments/${encodeURIComponent(id)}`);
  return p && PEDIDO.test(String(p.external_reference || '')) ? p.external_reference : null;
}
