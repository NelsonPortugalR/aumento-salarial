// Recibe un evento anónimo del embudo (sin respuestas ni sueldo) y lo guarda como una clave en Netlify Blobs.
import { getStore } from '@netlify/blobs';
import { claveEvento, json, leerJSON } from '../lib/comun.mjs';

// Bots y navegadores automáticos (como la captura que toma Netlify en cada despliegue) no cuentan
const AUTOMATICO = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|phantom|selenium|puppeteer|playwright/i;

export default async req => {
  if (AUTOMATICO.test(req.headers.get('user-agent') || '')) return new Response(null, { status: 204 });
  const clave = claveEvento(await leerJSON(req, 1024));
  if (!clave) return json({ ok: false }, 400);
  await getStore('eventos').set(clave, '1');
  return new Response(null, { status: 204 });
};

export const config = {
  path: '/api/evento',
  method: 'POST',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowSize: 60, windowLimit: 120 }
};
