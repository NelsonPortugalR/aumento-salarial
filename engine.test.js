// Pruebas del motor: invariantes que deben cumplirse para cualquier perfil.
const fs = require('fs');
const vm = require('vm');

const code = ['10_data.js', '15_bands.js', '20_engine.js', '30_kit.js'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
const ctx = vm.createContext({ console });
const G = vm.runInContext(code + '\n;({ CONFIG, MARKET, Engine, Kit, LEVELS, ROLES, SECTORS, REGIONS, SIZES, EXPERIENCE })', ctx);
const { CONFIG, MARKET, Engine, Kit, LEVELS, ROLES, SECTORS, REGIONS, SIZES, EXPERIENCE } = G;

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.error('FALLA:', msg); } }

const base = { puesto: 'contabilidad', nivel: 'analista', sector: 'industria', region: 'lima', tamano: 's3', contrato: 'indefinido', experiencia: 'e3', antiguedad: 't3', sueldo: '3000', aumento: 'a99', funciones: 'mas', empresa: 'estable' };
const withA = patch => Object.assign({}, base, patch);

// 1) Catálogos y datos alineados
for (const r of ROLES) ok(MARKET.roles[r.id], `puesto sin datos: ${r.id}`);
for (const s of SECTORS) ok(MARKET.sectors[s.id], `sector sin datos: ${s.id}`);
for (const g of REGIONS) ok(MARKET.regions[g.id], `región sin datos: ${g.id}`);
for (const l of LEVELS) ok(MARKET.levels[l.id], `nivel sin datos: ${l.id}`);
for (const e of EXPERIENCE) ok(MARKET.experience[e.id], `experiencia sin datos: ${e.id}`);

// 2) La banda sube con el nivel
const p50 = lvl => Engine.band(withA({ nivel: lvl })).p50;
ok(p50('asistente') < p50('analista') && p50('analista') < p50('senior') && p50('senior') < p50('jefe') && p50('jefe') < p50('gerente'), 'la mediana no sube con el nivel');
ok(p50('analista') < p50('supervisor') && p50('supervisor') < p50('jefe'), 'supervisor fuera de orden');

// 3) Lima paga más que cualquier región; empresa más grande no paga menos; más experiencia no paga menos
for (const g of REGIONS) if (g.id !== 'lima') ok(Engine.band(withA({ region: g.id })).p50 <= Engine.band(base).p50, `región ${g.id} sobre Lima`);
for (const lvl of LEVELS.map(l => l.id)) {
  const bySize = SIZES.map(s => Engine.band(withA({ nivel: lvl, tamano: s.id })).p50);
  ok(bySize.every((v, i) => i === 0 || v >= bySize[i - 1]), `tamaño no monótono en ${lvl}: ${bySize}`);
  const byExp = EXPERIENCE.map(e => Engine.band(withA({ nivel: lvl, experiencia: e.id })).p50);
  ok(byExp.every((v, i) => i === 0 || v >= byExp[i - 1]), `experiencia no monótona en ${lvl}: ${byExp}`);
}

// 4) Percentiles coherentes con la banda
const b = Engine.band(base);
ok(Math.abs(Engine.percentile(b.p50, b) - 50) <= 1, 'percentil de la mediana');
ok(Math.abs(Engine.percentile(b.p25, b) - 25) <= 1, 'percentil del P25');
ok(Math.abs(Engine.percentile(b.p75, b) - 75) <= 1, 'percentil del P75');
ok(b.p25 < b.p50 && b.p50 < b.p75, 'banda desordenada');

// 5) Piso legal: nadie en planilla a tiempo completo bajo la RMV
const low = Engine.band(withA({ nivel: 'asistente', puesto: 'atencion', region: 'huancavelica', tamano: 's1', experiencia: 'e0', sector: 'educacion' }));
ok(low.p25 >= CONFIG.rmv, `P25 bajo la RMV: ${low.p25}`);

// 6) Confianza honesta
ok(Engine.confidence(base) === 'alta', 'contabilidad analista en Lima debería ser confianza alta');
ok(Engine.confidence(withA({ puesto: 'otro' })) === 'baja', 'otro puesto debería ser confianza baja');
ok(Engine.confidence(withA({ puesto: 'datos' })) === 'baja', 'datos tiene pocas observaciones propias');
ok(Engine.confidence(withA({ nivel: 'gerente' })) !== 'alta', 'gerencias no deberían tener confianza alta');

// 7) El variable cuenta para la posición
const sinVar = Engine.recommend(withA({ sueldo: '2500' }), new Date('2026-10-04'));
const conVar = Engine.recommend(withA({ sueldo: '2500', variable: '1500' }), new Date('2026-10-04'));
ok(conVar.pct > sinVar.pct, 'el variable no cambia la posición');

// 8) Cifras del kit: orden, tope y escalera
const now = new Date('2026-10-04');
let combos = 0;
for (const role of ROLES.map(r => r.id)) for (const lvl of LEVELS.map(l => l.id)) for (const sueldo of [1400, 2600, 4200, 7000, 12000]) for (const variable of [0, 800]) {
  const a = withA({ puesto: role, nivel: lvl, sueldo: String(sueldo), variable: String(variable) });
  const r = Engine.recommend(a, now);
  const n = Engine.numbers(a, r);
  combos++;
  ok(n.pretFrom >= Math.round(sueldo * 1.10 / 100) * 100 - 50, `pretensión bajo el sueldo actual + 10%: ${role} ${lvl} ${sueldo}`);
  ok(n.pretTo > n.pretFrom, 'pretensión sin rango');
  if (n.anchor) {
    ok(n.anchor >= n.target && n.target >= n.floor && n.floor > sueldo, `cifras desordenadas ${role} ${lvl} ${sueldo}: ${n.anchor}/${n.target}/${n.floor}`);
    ok(n.anchor <= sueldo * (1 + CONFIG.capNoPromotion) + 10, `ancla sobre el tope: ${n.anchor} para ${sueldo}`);
    ok(n.ladder.every((v, i) => i === 0 || v < n.ladder[i - 1]), 'escalera no decreciente');
    ok(n.ladder[n.ladder.length - 1] >= n.floor, 'escalera bajo el piso');
    const kit = Kit.build(a, r, n, { trato: 'tu', estilo: 'cercano' }, now);
    ok(kit.raiseContext && kit.raiseContext.includes('%'), 'falta el contexto de aumentos 2026');
  }
}
ok(combos === ROLES.length * LEVELS.length * 10, 'combinaciones');

// 9) Bruto y neto 2026
ok(Math.abs(Engine.netFromGross(5000, 'afp') - 4191) <= 5, `neto de S/ 5,000 con AFP: ${Engine.netFromGross(5000, 'afp')}`);
for (const g of [1230, 2500, 4000, 6000, 9000, 15000, 30000]) for (const sys of ['afp', 'onp']) {
  const back = Engine.grossFromNet(Engine.netFromGross(g, sys), sys);
  ok(Math.abs(back - g) <= 2, `ida y vuelta bruto-neto ${g} ${sys}: ${back}`);
}
ok(Engine.netFromGross(2500, 'afp') > Engine.netFromGross(2500, 'onp'), 'AFP mixta descuenta menos que ONP');

// 10) Momento: plazo fijo con recortes no es momento de pedir
const plazo = Engine.recommend(withA({ contrato: 'plazo', vence: 'v3', empresa: 'recorta', sueldo: '2600' }), now);
ok(plazo.momento.state === 'cerrado' && /renovación/.test(plazo.momento.text), 'riesgo de no renovación no detectado');

// 11) Caso típico de la herramienta: bajo el mercado, caso fuerte, temporada de presupuestos
const tipico = Engine.recommend(withA({ sueldo: '2400', funciones: 'personas' }), now);
ok(tipico.code === 'pide_ahora', `recomendación esperada pide_ahora, salió ${tipico.code}`);
ok(tipico.caso.strengths.some(s => /precios en Lima/.test(s)), 'falta el argumento de inflación');

// 12) Monto que parece anual
ok(!!Engine.salaryCheck(withA({ sueldo: '60000' })), 'no avisa de un sueldo que parece anual');
ok(!Engine.salaryCheck(base), 'avisa sin motivo');

// 13) Capa de respuestas propias y registro anónimo
const before = Engine.band(base).p50;
MARKET.own = { cells: { [Engine.ownKey(base)]: { f: 1.1, n: 60 } } };
const after = Engine.band(base);
ok(Math.abs(after.p50 / before - 1.1) < 0.02, `la capa propia no se aplica: ${before} -> ${after.p50}`);
ok(after.confidence === 'alta' && after.nOwn === 60, 'la capa propia no sube la confianza');
ok(Engine.band(withA({ region: 'arequipa' })).nOwn === 0, 'la capa propia se aplica fuera de su celda');
MARKET.own = { cells: {} };
const rec = Engine.responseRecord(withA({ nombre: 'Ana', razon_social: 'X SAC', dni: '12345678' }), Engine.recommend(base, now), now);
ok(!('nombre' in rec) && !('razon_social' in rec) && !('dni' in rec) && rec.empresa === 'estable', 'el registro filtra datos personales');
ok(rec.mes === '2026-10' && rec.sueldo === 3000 && rec.puesto === 'contabilidad', 'registro incompleto');

// 14) Orientación a pedir: toda recomendación dice cómo pedir; solo "esperar" pospone y con mes
const codes = {};
for (const aumento of ['a6', 'a12', 'a24', 'a99', 'nunca', 'no']) for (const empresa of ['crece', 'estable', 'recorta']) for (const logros of ['varios', 'alguno', 'no']) for (const sueldo of [2000, 3500, 6000]) for (const antiguedad of ['t0', 't1', 't3']) {
  const a = withA({ aumento, empresa, logros, sueldo: String(sueldo), antiguedad });
  const r = Engine.recommend(a, now);
  codes[r.code] = (codes[r.code] || 0) + 1;
  ok(!['no_pidas', 'alcance', 'otra_cosa'].includes(r.code), 'código antiguo de no pedir');
  if (r.code === 'esperar') ok(/^Pide en [a-z]+$/.test(r.stamp), `esperar sin mes: ${r.stamp}`);
  const kit = Kit.build(a, r, Engine.numbers(a, r), { trato: 'tu' }, now);
  ok(kit.timeline && kit.timeline.length >= 4 && kit.ifYes && kit.planB, 'kit sin cronograma, sí o plan B');
  ok(!/\bcreo\b/.test(kit.speech.auditoria + kit.speech.pedido), 'el speech usa muletillas');
}
const total = Object.values(codes).reduce((x, y) => x + y, 0);
ok((codes.esperar || 0) / total < 0.6, `demasiados "esperar": ${JSON.stringify(codes)}`);
const fuerte = Engine.recommend(withA({ sueldo: '2400', logros: 'varios' }), now);
ok(fuerte.caso.level !== 'debil', 'logros medibles no suman al caso');

console.log(`engine.test: ${checks - failures}/${checks} verificaciones OK`);
console.log(`ejemplo: contabilidad, analista, industria, Lima, 101-500, 3-5 años -> P25 ${b.p25}, mediana ${b.p50}, P75 ${b.p75} (${b.confidence})`);
if (failures) process.exit(1);
