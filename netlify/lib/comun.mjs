// Utilidades de las funciones de Netlify: respuestas, fechas de Lima, validación y acceso al panel.
import { createHash, timingSafeEqual } from 'node:crypto';
import { CATALOGOS, PASOS, SALIDAS, CONSENTIMIENTO } from './catalogos.mjs';

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

// Perú no cambia de hora: UTC-5 todo el año
export const limaDia = (now = new Date()) => new Date(now.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
export const limaMes = (now = new Date()) => limaDia(now).slice(0, 7);
export function diasHasta(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(limaDia(new Date(now.getTime() - i * 86400e3)));
  return out;
}

export async function leerJSON(req, max = 4096) {
  const text = await req.text();
  if (!text || text.length > max) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

// Panel: token en la cabecera Authorization, comparado en tiempo constante con la variable PANEL_TOKEN
// o, si no existe, con la huella SHA-256 guardada en acceso.mjs
export function autorizado(req, token, huella) {
  const h = req.headers.get('authorization') || '';
  const given = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!given) return false;
  const a = createHash('sha256').update(given).digest();
  if (token) return timingSafeEqual(a, createHash('sha256').update(token).digest());
  return /^[0-9a-f]{64}$/.test(huella || '') && timingSafeEqual(a, Buffer.from(huella, 'hex'));
}

/* ---------- Eventos del embudo ---------- */
export const EVENTOS = ['visit', 'test_start', 'step', 'test_complete', 'exit_route', 'paywall_view', 'pay_click', 'wa_click', 'code_ok', 'code_bad', 'kit_built', 'sim_start', 'polish', 'share', 'contribute', 'copy', 'download', 'method_view', 'privacy_view', 'restart'];
const ID = /^[a-z0-9]{6,16}$/;
const DETALLE = /^[a-z0-9_.-]{0,48}$/;

// Cada evento es una clave sin contenido: día/sesión/tiempo~evento~detalle. El panel cuenta con solo listar claves.
export function claveEvento(b, now = new Date()) {
  if (!b || typeof b !== 'object') return null;
  const s = String(b.s || ''), e = String(b.e || ''), d = String(b.d || '').toLowerCase();
  if (!ID.test(s) || !EVENTOS.includes(e) || !DETALLE.test(d)) return null;
  if (e === 'step' && !PASOS.includes(d)) return null;
  if (e === 'exit_route' && !SALIDAS.includes(d)) return null;
  const t = now.getTime().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  return `${limaDia(now)}/${s}/${t}~${e}${d ? '~' + d : ''}`;
}
export function leerClave(k) {
  const [dia, sesion, resto] = String(k).split('/');
  if (!resto) return null;
  const [t, e, d = ''] = resto.split('~');
  return e ? { dia, sesion, t, e, d } : null;
}

/* ---------- Aporte anónimo (con consentimiento expreso) ---------- */
const REQUERIDOS = ['puesto', 'nivel', 'sector', 'region', 'tamano', 'contrato', 'experiencia', 'antiguedad', 'aumento', 'funciones', 'empresa'];
const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null; };

// Devuelve solo los campos conocidos y válidos; null si el registro no sirve. Nunca guarda IP ni navegador.
export function validarAporte(r, now = new Date()) {
  if (!r || typeof r !== 'object' || r.schema !== 1 || !ID.test(String(r.id || ''))) return null;
  const v = String(r.consentimiento || '');
  if (!/^\d{4}-\d{2}$/.test(v) || v > CONSENTIMIENTO) return null;
  const out = { schema: 1, id: r.id, mes: limaMes(now), recibido: limaDia(now), consentimiento: v };
  if (typeof r.modelo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.modelo)) out.modelo = r.modelo;
  for (const k of Object.keys(CATALOGOS)) {
    if (r[k] == null || r[k] === '') { if (REQUERIDOS.includes(k)) return null; continue; }
    if (!CATALOGOS[k].includes(r[k])) return null;
    out[k] = r[k];
  }
  if (out.contrato !== 'plazo') delete out.vence;
  if (r.campo === true) out.campo = true;
  out.sueldo = num(r.sueldo, 500, 150000);
  out.variable = num(r.variable || 0, 0, 150000);
  if (out.sueldo == null || out.variable == null) return null;
  const p50 = num(r.p50, 300, 300000), pct = num(r.pct, 0, 100);
  if (p50 != null) out.p50 = p50;
  if (pct != null) out.pct = pct;
  if (typeof r.code === 'string' && /^[a-z_]{2,20}$/.test(r.code)) out.code = r.code;
  return out;
}

/* ---------- Libro de Reclamaciones ---------- */
const texto = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
// Solo valida: los datos de la hoja se guardan en Netlify Forms, no aquí
export function validarReclamo(b) {
  if (!b || typeof b !== 'object') return false;
  return texto(b.nombre, 120) && texto(b.documento, 20) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || '')) &&
    ['reclamo', 'queja'].includes(b.tipo) && texto(b.detalle, 4000) && texto(b.pedido, 2000);
}
export const numeroHoja = (anio, n) => `${String(n).padStart(6, '0')}-${anio}`;
