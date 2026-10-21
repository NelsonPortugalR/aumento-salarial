// Guarda el aporte anónimo de quien tocó "Sí, aportar mi dato" (consentimiento expreso, Ley 29733).
import { getStore } from '@netlify/blobs';
import { json, leerJSON, validarAporte } from '../lib/comun.mjs';

export default async req => {
  const rec = validarAporte(await leerJSON(req, 4096));
  if (!rec) return json({ ok: false }, 400);
  // La clave es el id aleatorio del test: un mismo test no se cuenta dos veces
  await getStore('aportes').setJSON(`${rec.mes}/${rec.id}`, rec, { onlyIfNew: true });
  return json({ ok: true });
};

export const config = {
  path: '/api/aporte',
  method: 'POST',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowSize: 60, windowLimit: 10 }
};
