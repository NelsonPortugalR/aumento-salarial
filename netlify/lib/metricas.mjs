// Resumen del embudo a partir de las claves de eventos (una sesión = una pestaña del navegador).
import { leerClave } from './comun.mjs';
import { PASOS } from './catalogos.mjs';

const tiene = (s, ...evs) => evs.some(e => s.ev.has(e));
export const EMBUDO = [
  ['visitas', () => true],
  ['iniciaron', s => tiene(s, 'test_start', 'step', 'test_complete', 'exit_route')],
  ['completaron', s => tiene(s, 'test_complete')],
  ['vieron_el_muro', s => tiene(s, 'paywall_view')],
  ['clic_en_pagar', s => tiene(s, 'pay_click', 'wa_click')],
  ['desbloquearon', s => tiene(s, 'code_ok', 'paid')],
  ['armaron_el_kit', s => tiene(s, 'kit_built')],
  ['practicaron', s => tiene(s, 'sim_start')]
];
const ACCIONES = ['share', 'contribute', 'copy', 'download', 'polish', 'method_view', 'privacy_view', 'restart', 'code_bad'];
const tasa = (a, b) => b ? Math.round(1000 * a / b) / 1000 : null;

export function sesiones(claves) {
  const ses = new Map();
  for (const k of claves) {
    const p = leerClave(k);
    if (!p) continue;
    let s = ses.get(p.sesion);
    if (!s) ses.set(p.sesion, s = { dia: p.dia, ev: new Set(), pasos: new Set(), acciones: new Set(), variante: '', fuente: '', equipo: '', code: '', zona: '', salida: '' });
    if (p.dia < s.dia) s.dia = p.dia;
    s.ev.add(p.e);
    if (p.e === 'visit') { const [v, f, eq] = p.d.split('.'); s.variante = v || ''; s.fuente = f || ''; s.equipo = eq || ''; }
    else if (p.e === 'step') s.pasos.add(p.d);
    else if (p.e === 'test_complete') { const [c, z] = p.d.split('.'); s.code = c || ''; s.zona = z || ''; }
    else if (p.e === 'exit_route') s.salida = p.d;
    else if (p.e === 'paywall_view' && !s.variante) s.variante = p.d;
    if (ACCIONES.includes(p.e)) s.acciones.add(p.e === 'copy' && p.d ? 'copy_' + p.d : p.e);
  }
  return [...ses.values()];
}

export function resumir(claves, dias) {
  const lista = sesiones(claves);
  const contar = filtro => Object.fromEntries(EMBUDO.map(([n, f]) => [n, lista.filter(s => filtro(s) && f(s)).length]));
  const por = (campo, filtro = () => true) => {
    const valores = [...new Set(lista.filter(filtro).map(s => s[campo] || 'sin_dato'))];
    return valores.map(v => ({ valor: v, ...contar(s => filtro(s) && (s[campo] || 'sin_dato') === v) })).sort((a, b) => b.visitas - a.visitas);
  };
  const embudo = contar(() => true);
  const reparto = (campo, filtro) => {
    const o = {};
    for (const s of lista) if (filtro(s)) { const v = s[campo] || 'sin_dato'; o[v] = (o[v] || 0) + 1; }
    return Object.entries(o).map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n);
  };
  const acciones = {};
  for (const s of lista) for (const a of s.acciones) acciones[a] = (acciones[a] || 0) + 1;
  return {
    embudo,
    tasas: {
      inicio_a_completo: tasa(embudo.completaron, embudo.iniciaron),
      completo_a_muro: tasa(embudo.vieron_el_muro, embudo.completaron),
      muro_a_clic: tasa(embudo.clic_en_pagar, embudo.vieron_el_muro),
      completo_a_desbloqueo: tasa(embudo.desbloquearon, embudo.completaron)
    },
    pasos: PASOS.map((id, i) => ({ paso: id, sesiones: i === 0 ? embudo.iniciaron : lista.filter(s => s.pasos.has(id)).length })),
    resultados: reparto('code', s => s.ev.has('test_complete')),
    zonas: reparto('zona', s => s.ev.has('test_complete')),
    salidas: reparto('salida', s => s.ev.has('exit_route')),
    precios: por('variante'),
    fuentes: por('fuente'),
    equipos: por('equipo'),
    acciones,
    diario: (dias || [...new Set(lista.map(s => s.dia))].sort()).map(d => ({
      dia: d,
      visitas: lista.filter(s => s.dia === d).length,
      completaron: lista.filter(s => s.dia === d && s.ev.has('test_complete')).length
    }))
  };
}
