/* ============================================================
   MOTOR — reglas fijas y auditables (la IA no decide nada aquí)
   ============================================================ */
const Engine = (() => {
  const round50 = x => Math.round(x / 50) * 50;
  const round100 = x => Math.round(x / 100) * 100;

  // Abramowitz-Stegun 7.1.26
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));

  function route(a) {
    return EXIT_ROUTES.includes(a.contrato) ? a.contrato : null;
  }

  function band(a) {
    const level = byId(LEVELS, a.nivel) || LEVELS[1];
    const role = byId(ROLES, a.puesto) || byId(ROLES, 'otro');
    const mult = role.mult
      * ((byId(SECTORS, a.sector) || {}).mult || 1)
      * ((byId(REGIONS, a.region) || {}).mult || 1)
      * ((byId(SIZES, a.tamano) || {}).mult || 1)
      * ((byId(EXPERIENCE, a.experiencia) || {}).mult || 1)
      * (a.campo ? FIELD_MULT : 1);
    let p50 = level.base * mult;
    let p25 = Math.max(p50 * 0.80, CONFIG.rmv);
    p50 = Math.max(p50, CONFIG.rmv * 1.08);
    let p75 = Math.max(p50 * 1.25, CONFIG.rmv * 1.25);
    if (p50 <= p25) p50 = p25 * 1.12;
    if (p75 <= p50) p75 = p50 * 1.15;
    return {
      p25: round50(p25), p50: round50(p50), p75: round50(p75),
      confidence: 'baja', preliminary: true,
      otherRole: role.id === 'otro'
    };
  }

  function percentile(salary, b) {
    const mu = Math.log(b.p50);
    const sigma = Math.log(b.p75 / b.p25) / (2 * 0.6744898);
    const z = (Math.log(Math.max(salary, 1)) - mu) / sigma;
    return Math.max(1, Math.min(99, Math.round(normCdf(z) * 100)));
  }

  // Brecha frente a la mediana, con la incertidumbre de una banda preliminar (±8%)
  function gapRange(salary, b) {
    const u = 0.08;
    const lo = b.p50 * (1 - u), hi = b.p50 * (1 + u);
    const g1 = (lo - salary) / lo * 100, g2 = (hi - salary) / hi * 100;
    return [Math.round(Math.min(g1, g2)), Math.round(Math.max(g1, g2))];
  }

  const position = pct => pct < 35 ? 'bajo' : (pct <= 70 ? 'rango' : 'alto');

  function caseScore(a, pos) {
    let score = 0;
    const strengths = [], weaknesses = [];
    if (a.funciones === 'personas') { score += 2; strengths.push('Ahora tienes personas a cargo y tu sueldo no cambió: es tu argumento más fuerte.'); }
    else if (a.funciones === 'mas') { score += 1.5; strengths.push('Asumiste más responsabilidades sin ajuste de sueldo.'); }
    if (a.aumento === 'nunca') { score += 2; strengths.push('Nunca te han subido el sueldo en este puesto.'); }
    else if (a.aumento === 'a99') { score += 2; strengths.push('Llevas más de dos años sin aumento.'); }
    else if (a.aumento === 'a24') { score += 1.5; strengths.push('Llevas más de un año sin ajuste.'); }
    else if (a.aumento === 'a12') { score += 0.5; }
    else if (a.aumento === 'a6') { score -= 1; weaknesses.push('Tu último ajuste fue hace menos de seis meses.'); }
    else if (a.aumento === 'no') { score += 0.5; weaknesses.push('Te dijeron que no hace poco: insistir de inmediato suele cerrar más la puerta.'); }
    if (pos === 'bajo') strengths.push('Estás por debajo de la mediana de tu perfil.');
    if (a.antiguedad === 't3') { score += 1; strengths.push('Tienes más de dos años en el puesto: conoces el trabajo y se nota.'); }
    else if (a.antiguedad === 't2') { score += 0.5; }
    else if (a.antiguedad === 't0') { score -= 2; weaknesses.push('Llevas menos de tres meses en el puesto.'); }
    if (a.experiencia === 'e5' || a.experiencia === 'e10') score += 0.5;
    if (a.contrato === 'plazo' && (a.vence === 'v1' || a.vence === 'v3')) strengths.push('Tu contrato vence pronto: la conversación igual va a ocurrir.');
    if (a.empresa === 'crece') strengths.push('Tu empresa está creciendo.');
    if (pos === 'alto') weaknesses.push('Ya estás sobre la mediana: un aumento de base será difícil.');
    if (a.empresa === 'recorta') weaknesses.push('Tu empresa está recortando gastos.');
    const level = score >= 3.5 ? 'fuerte' : (score >= 2 ? 'medio' : 'debil');
    return {
      score, level,
      strength: strengths[0] || null,
      weakness: weaknesses[0] || 'Todavía no sabemos tus logros con números, y es lo que más pesa en la reunión.'
    };
  }

  function moment(a, now) {
    const m = now.getMonth() + 1;
    const closed = [], open = [];
    if (a.antiguedad === 't0') closed.push({ t: 'Estás en tus primeros meses: primero consolida tu puesto.', cuando: 'Cuando termines tu periodo de prueba y tengas resultados que mostrar.' });
    if (a.aumento === 'a6') closed.push({ t: 'Tu último ajuste fue hace menos de seis meses.', cuando: 'Cuando se cumpla un año de tu último ajuste.' });
    if (a.aumento === 'no') closed.push({ t: 'Te dijeron que no hace poco.', cuando: 'En tres a seis meses, con un caso más fuerte.' });
    if (a.empresa === 'recorta') closed.push({ t: 'Tu empresa está recortando: un pedido ahora tiene pocas probabilidades.', cuando: 'Cuando la empresa se estabilice. Mientras, junta logros con números.' });
    if (a.contrato === 'plazo' && (a.vence === 'v1' || a.vence === 'v3')) open.push('Tu contrato vence pronto: la renovación es una conversación que igual va a ocurrir.');
    if (m >= 9 && m <= 11) open.push('Es temporada de presupuestos: lo que se pide ahora puede entrar al del próximo año.');
    if (m >= 1 && m <= 3) open.push('Es temporada de evaluaciones y ajustes anuales.');
    if (a.empresa === 'crece') open.push('Tu empresa está creciendo.');
    if (closed.length) return { state: 'cerrado', label: 'Momento cerrado', text: closed[0].t, cuando: closed[0].cuando };
    if (open.length) return { state: 'abierto', label: 'Buen momento', text: open.slice(0, 2).join(' ') };
    return { state: 'neutro', label: 'Momento neutro', text: 'No hay nada en contra, pero tampoco un empuje claro: elige bien la fecha.' };
  }

  const VERDICTS = {
    pide_ahora:  { color: 'go',   stamp: 'Pide ahora', sub: 'Estás bajo el mercado, tu caso es sólido y el momento ayuda.' },
    pide_pronto: { color: 'go',   stamp: 'Pide en unas semanas', sub: 'Estás bajo el mercado y tienes caso. Prepara la conversación y elige bien la fecha.' },
    construye:   { color: 'wait', stamp: 'Prepárate 60 días', sub: 'Estás bajo el mercado, pero tu caso todavía es débil. Junta logros con números y pide en dos meses.' },
    merito:      { color: 'go',   stamp: 'Pide por mérito', sub: 'Estás dentro del rango de tu perfil. Un aumento es posible si lo sustentas con resultados.' },
    alcance:     { color: 'wait', stamp: 'Pide crecer, no plata', sub: 'Estás en rango y tu caso es débil. Hoy rinde más pedir un proyecto, un título o una capacitación.' },
    otra_cosa:   { color: 'wait', stamp: 'Negocia otra cosa', sub: 'Ya estás sobre la mediana. Un aumento de base será difícil; un bono, horario o capacitación, no tanto.' },
    no_pidas:    { color: 'stop', stamp: 'No pidas por ahora', sub: 'Estás sobre la mediana y tu caso es débil. Pedir ahora te gasta una carta que conviene guardar.' },
    esperar:     { color: 'wait', stamp: 'Todavía no', sub: '' },
    mercado:     { color: 'wait', stamp: 'Mira afuera', sub: 'Estás muy por debajo del mercado y adentro la puerta está cerrada. Tu mejor aumento puede ser otra oferta.' }
  };

  function recommend(a, now = new Date()) {
    const r = { route: route(a) };
    if (r.route) return r;
    const s = Number(a.sueldo) || 0;
    r.band = band(a);
    r.pct = percentile(s, r.band);
    r.pos = position(r.pct);
    r.gap = gapRange(s, r.band);
    r.caso = caseScore(a, r.pos);
    r.momento = moment(a, now);
    let code;
    if (r.pct < 20 && (a.aumento === 'no' || a.empresa === 'recorta')) code = 'mercado';
    else if (r.momento.state === 'cerrado') code = 'esperar';
    else if (r.pos === 'bajo') code = r.caso.level === 'debil' ? 'construye' : (r.momento.state === 'abierto' ? 'pide_ahora' : 'pide_pronto');
    else if (r.pos === 'rango') code = r.caso.level === 'debil' ? 'alcance' : 'merito';
    else code = r.caso.level === 'debil' ? 'no_pidas' : 'otra_cosa';
    const v = VERDICTS[code];
    r.code = code;
    r.color = v.color;
    r.stamp = v.stamp;
    r.sub = code === 'esperar' ? r.momento.text + ' Usa este tiempo para preparar tu caso.' : v.sub;
    r.cuando = r.momento.cuando || null;
    return r;
  }

  // Número preciso, no redondo: se percibe calculado, no inventado
  function precise(x, cap) {
    let v = Math.round(x / 10) * 10;
    if (v % 50 === 0) v += 20;
    if (cap && v > cap) {
      v = Math.floor(cap / 10) * 10;
      if (v % 50 === 0) v -= 20;
    }
    return v;
  }

  // Cifras del kit: ancla (lo que dices), objetivo (lo que esperas), piso (lo que aceptas)
  // y escalera de concesiones decrecientes, con el último número preciso
  function numbers(a, r) {
    const s = Number(a.sueldo) || 0, b = r.band;
    const out = { anchor: null, target: null, floor: null, annual: null, pretFrom: round100(b.p50), pretTo: round100(b.p75) };
    const asksRaise = ['pide_ahora', 'pide_pronto', 'construye', 'merito', 'esperar', 'mercado'].includes(r.code) && r.pos !== 'alto';
    if (!asksRaise) return out;
    const cap = s * (1 + CONFIG.capNoPromotion);
    let target, anchor, floor;
    if (r.pos === 'bajo') {
      target = Math.min(b.p50, s * 1.15);
      anchor = Math.min(Math.max(target * 1.05, target), cap);
      floor = Math.max(s * 1.05, s + (target - s) * 0.5);
    } else {
      target = s * 1.08;
      anchor = s * 1.12;
      floor = s * 1.04;
    }
    target = round50(target); floor = round50(floor);
    anchor = precise(anchor, cap);
    if (anchor <= target) anchor = precise(target + 30, cap);
    if (anchor <= target) anchor = target;
    if (floor > target) floor = target;
    if (floor <= s) floor = round50(s * 1.03) > s ? round50(s * 1.03) : s + 50;
    if (target <= s) target = floor;
    if (anchor <= s) anchor = target;
    out.anchor = anchor; out.target = target; out.floor = floor;
    out.annual = Math.round((target - s) * CONFIG.annualFactor / 10) * 10;
    const gap = anchor - target;
    const ladder = [anchor];
    if (gap >= 30) {
      ladder.push(precise(anchor - gap * 2 / 3));
      ladder.push(target);
      ladder.push(Math.max(precise(target - gap / 6), precise(floor + 10)));
    } else {
      ladder.push(Math.max(precise(target - 20), precise(floor + 10)));
    }
    out.ladder = ladder.filter((v, i, arr) => i === 0 || (v < arr[i - 1] && v >= floor));
    return out;
  }

  return { band, percentile, gapRange, position, caseScore, moment, recommend, numbers, route, round50, round100, precise };
})();
