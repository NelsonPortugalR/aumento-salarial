// Panel interno: resumen del embudo y exportación de aportes y eventos. Requiere la variable PANEL_TOKEN.
import { getStore } from '@netlify/blobs';
import { autorizado, diasHasta, json, leerClave, limaDia } from '../lib/comun.mjs';
import { resumir } from '../lib/metricas.mjs';

const listar = async (store, prefix) => (await store.list({ prefix })).blobs.map(b => b.key);
async function enLotes(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...await Promise.all(items.slice(i, i + n).map(fn)));
  return out;
}
const archivo = (body, tipo, nombre) => new Response(body, {
  headers: { 'content-type': tipo, 'content-disposition': `attachment; filename="${nombre}"`, 'cache-control': 'no-store' }
});

export default async req => {
  if (!autorizado(req, Netlify.env.get('PANEL_TOKEN'))) return json({ error: 'no_autorizado' }, 401);
  const url = new URL(req.url);
  const dias = Math.min(180, Math.max(1, parseInt(url.searchParams.get('dias'), 10) || 30));
  const rango = diasHasta(dias);
  const eventos = getStore('eventos');
  const clavesEventos = async () => (await enLotes(rango, 15, d => listar(eventos, d + '/'))).flat();

  if (url.pathname === '/api/resumen') {
    const claves = await clavesEventos();
    const aportes = await listar(getStore('aportes'), '');
    const anio = limaDia().slice(0, 4);
    const reclamos = await listar(getStore('reclamos'), anio + '/');
    const porMes = {};
    for (const k of aportes) porMes[k.slice(0, 7)] = (porMes[k.slice(0, 7)] || 0) + 1;
    return json({
      generado: new Date().toISOString(), dias, desde: rango[0], hasta: rango[rango.length - 1], eventos: claves.length,
      ...resumir(claves, rango),
      aportes: { total: aportes.length, por_mes: porMes },
      reclamos: { anio, total: reclamos.length }
    });
  }

  const tipo = url.searchParams.get('tipo');
  if (tipo === 'aportes') {
    const store = getStore('aportes');
    const mes = url.searchParams.get('mes');
    const claves = await listar(store, mes && /^\d{4}-\d{2}$/.test(mes) ? mes + '/' : '');
    const recs = (await enLotes(claves, 20, k => store.get(k, { type: 'json' }))).filter(Boolean);
    return archivo(recs.map(r => JSON.stringify(r) + '\n').join(''), 'application/x-ndjson; charset=utf-8', `aportes_${limaDia()}.jsonl`);
  }
  if (tipo === 'eventos') {
    const filas = (await clavesEventos()).map(leerClave).filter(Boolean).map(p => [p.dia, p.sesion, p.t, p.e, p.d].join(','));
    return archivo(['dia,sesion,orden,evento,detalle', ...filas].join('\n') + '\n', 'text/csv; charset=utf-8', `eventos_${limaDia()}.csv`);
  }
  return json({ error: 'tipo_desconocido' }, 400);
};

export const config = { path: ['/api/resumen', '/api/exportar'], method: 'GET' };
