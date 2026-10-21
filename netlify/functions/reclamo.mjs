// Asigna el número correlativo de una hoja del Libro de Reclamaciones. La hoja se guarda en Netlify Forms, no aquí.
import { getStore } from '@netlify/blobs';
import { json, leerJSON, limaDia, numeroHoja, validarReclamo } from '../lib/comun.mjs';

export default async req => {
  if (!validarReclamo(await leerJSON(req, 16384))) return json({ ok: false, error: 'datos_incompletos' }, 400);
  const now = new Date();
  const anio = limaDia(now).slice(0, 4);
  const store = getStore({ name: 'reclamos', consistency: 'strong' });
  const { blobs } = await store.list({ prefix: anio + '/' });
  let n = blobs.reduce((m, b) => Math.max(m, parseInt(b.key.slice(5), 10) || 0), 0) + 1;
  // Cada número se reserva con una escritura que solo procede si la clave no existe: dos hojas nunca comparten número
  for (let i = 0; i < 25; i++, n++) {
    const { modified } = await store.set(`${anio}/${String(n).padStart(6, '0')}`, now.toISOString(), { onlyIfNew: true });
    if (modified) return json({ ok: true, numero: numeroHoja(anio, n), fecha: now.toISOString() });
  }
  return json({ ok: false, error: 'ocupado' }, 503);
};

export const config = { path: '/api/reclamo', method: 'POST' };
