/* ============================================================
   MOTOR — reglas fijas y auditables (la IA no decide nada aquí)
   ============================================================ */
const Engine = (() => {
  const round50 = x => Math.round(x / 50) * 50;
  const round100 = x => Math.round(x / 100) * 100;
  const Z75 = 0.6744898;

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

  const levelOf = a => (MARKET.levels[a.nivel] ? a.nivel : 'analista');
  const total = a => (Number(a.sueldo) || 0) + (Number(a.variable) || 0);

  // Factores del perfil: cada uno sale de la ENAHO (ver data/METODOLOGIA.md)
  function factors(a) {
    const lvl = levelOf(a);
    const grp = MARKET.level_group[lvl];
    const role = MARKET.roles[a.puesto] || MARKET.roles.otro;
    const damp = MARKET.role_damping[lvl] == null ? 1 : MARKET.role_damping[lvl];
    const sector = MARKET.sectors[a.sector] || MARKET.sectors.otro;
    const region = MARKET.regions[a.region] || MARKET.regions.otra;
    return {
      lvl, grp,
      role: Math.pow(role.mult, damp),
      sector: sector.mult,
      region: region.mult[grp],
      size: (MARKET.sizes[grp] || {})[a.tamano] || 1,
      exp: MARKET.experience[a.experiencia] || 1,
      field: a.campo ? MARKET.field_mult : 1
    };
  }

  // Capa de respuestas propias del test (data/pipeline/04_responses.py): ajuste acotado por celda
  const ownKey = a => `${a.puesto}|${levelOf(a)}|${a.region === 'lima' ? 'lima' : 'prov'}`;
  function ownCell(a) {
    const own = MARKET.own && MARKET.own.cells;
    return (own && own[ownKey(a)]) || null;
  }

  // Confianza según cuántos datos respaldan el puesto, la región y el nivel
  function confidence(a) {
    const own = ownCell(a);
    if (own && own.n >= 50) return 'alta';
    const lvl = levelOf(a);
    const role = a.puesto !== 'otro' ? MARKET.roles[a.puesto] : null;
    const region = MARKET.regions[a.region];
    const score = n => (n >= 150 ? 2 : (n >= 40 ? 1 : 0));
    const c = Math.min(role ? score(role.n) : 0, region ? score(region.n) : 0, ['asistente', 'analista'].includes(lvl) ? 2 : 1);
    return ['baja', 'media', 'alta'][c];
  }

  function band(a) {
    const f = factors(a);
    const L = MARKET.levels[f.lvl];
    const own = ownCell(a);
    let p50 = L.p50 * f.role * f.sector * f.region * f.size * f.exp * f.field * (own ? own.f : 1);
    let p25 = p50 * L.lo, p75 = p50 * L.hi;
    // Nadie a tiempo completo en planilla gana menos que la RMV
    p25 = Math.max(p25, CONFIG.rmv);
    p50 = Math.max(p50, CONFIG.rmv * 1.08);
    p75 = Math.max(p75, CONFIG.rmv * 1.25);
    if (p50 <= p25) p50 = p25 * 1.08;
    if (p75 <= p50) p75 = p50 * 1.15;
    const role = MARKET.roles[a.puesto] || MARKET.roles.otro;
    const region = MARKET.regions[a.region] || MARKET.regions.otra;
    return {
      p25: round50(p25), p50: round50(p50), p75: round50(p75),
      confidence: confidence(a),
      nRole: role.n, nRegion: region.n, nOwn: own ? own.n : 0,
      method: L.metodo,
      otherRole: !MARKET.roles[a.puesto] || a.puesto === 'otro'
    };
  }

  // Percentil con una banda asimétrica: la parte alta del mercado se estira más que la baja
  function percentile(salary, b) {
    const x = Math.log(Math.max(salary, 1)), mu = Math.log(b.p50);
    const sigma = x < mu ? Math.log(b.p50 / b.p25) / Z75 : Math.log(b.p75 / b.p50) / Z75;
    return Math.max(1, Math.min(99, Math.round(normCdf((x - mu) / sigma) * 100)));
  }

  // Brecha frente a la mediana, con la incertidumbre que corresponde a la confianza
  const UNCERTAINTY = { alta: 0.05, media: 0.08, baja: 0.12 };
  function gapRange(salary, b) {
    const u = UNCERTAINTY[b.confidence] || 0.08;
    const lo = b.p50 * (1 - u), hi = b.p50 * (1 + u);
    const g1 = (lo - salary) / lo * 100, g2 = (hi - salary) / hi * 100;
    return [Math.round(Math.min(g1, g2)), Math.round(Math.max(g1, g2))];
  }

  const position = pct => pct < 35 ? 'bajo' : (pct <= 70 ? 'rango' : 'alto');

  // Inflación acumulada aproximada desde el último aumento (IPC de Lima)
  function inflationSince(a) {
    const inf = MARKET.context && MARKET.context.inflacion_lima;
    if (!inf) return null;
    if (a.aumento === 'a24') return { pct: inf['12m_pct'], text: 'el último año' };
    if (a.aumento === 'a99') return { pct: inf['24m_pct'], text: 'los últimos dos años', atLeast: true };
    return null;
  }

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
    const inf = inflationSince(a);
    if (inf) strengths.push(`En ${inf.text}, los precios en Lima subieron ${inf.atLeast ? 'más de ' : ''}${String(inf.pct).replace('.', ',')}%: sin ajuste, tu sueldo compra menos que antes.`);
    if (pos === 'bajo') strengths.push('Estás por debajo de la mediana de tu perfil.');
    if (a.antiguedad === 't3') { score += 1; strengths.push('Tienes más de dos años en el puesto: conoces el trabajo y se nota.'); }
    else if (a.antiguedad === 't2') { score += 0.5; }
    else if (a.antiguedad === 't0') { score -= 2; weaknesses.push('Llevas menos de tres meses en el puesto.'); }
    if (a.experiencia === 'e5' || a.experiencia === 'e10') score += 0.5;
    // Resultados medibles: lo que más pesa en la reunión (maletín de logros)
    if (a.logros === 'varios') { score += 1.5; strengths.unshift('Tienes resultados de este año con números: es lo que más pesa en la reunión.'); }
    else if (a.logros === 'alguno') { score += 0.5; }
    else if (a.logros === 'no') { score -= 0.5; weaknesses.unshift('Todavía no tienes tus resultados medidos: sin números, el pedido suena a deseo y no a propuesta.'); }
    if (a.contrato === 'plazo' && (a.vence === 'v1' || a.vence === 'v3')) strengths.push('Tu contrato vence pronto: la conversación igual va a ocurrir.');
    if (a.empresa === 'crece') strengths.push('Tu empresa está creciendo.');
    if (pos === 'alto') weaknesses.push('Ya estás sobre la mediana: un aumento de base será difícil.');
    if (a.empresa === 'recorta') weaknesses.push('Tu empresa está recortando gastos.');
    const level = score >= 3.5 ? 'fuerte' : (score >= 2 ? 'medio' : 'debil');
    return {
      score, level, strengths, weaknesses,
      strength: strengths[0] || null,
      weakness: weaknesses[0] || 'Todavía no sabemos tus logros con números, y es lo que más pesa en la reunión.'
    };
  }

  function moment(a, now) {
    const m = now.getMonth() + 1;
    const closed = [], open = [];
    if (a.antiguedad === 't0') closed.push({ t: 'Estás en tus primeros meses: primero consolida tu puesto.', cuando: 'Cuando termines tu periodo de prueba y tengas resultados que mostrar.', meses: 3 });
    if (a.aumento === 'a6') closed.push({ t: 'Tu último ajuste fue hace menos de seis meses.', cuando: 'Cuando se cumpla un año de tu último ajuste.', meses: 5 });
    if (a.aumento === 'no') closed.push({ t: 'Te dijeron que no hace poco.', cuando: 'En unos cuatro meses, con metas cumplidas y por escrito.', meses: 4 });
    if (a.contrato === 'plazo' && a.empresa === 'recorta') closed.push({ t: 'Tu contrato es a plazo fijo y tu empresa está recortando: pedir ahora puede poner en riesgo tu renovación.', cuando: 'Después de renovar. Mientras, junta logros con números.', meses: 3 });
    if (a.empresa === 'recorta') closed.push({ t: 'Tu empresa está recortando: un pedido de sueldo ahora tiene pocas probabilidades.', cuando: 'Cuando la empresa se estabilice. Mientras, junta logros con números.', meses: 3 });
    if (a.contrato === 'plazo' && (a.vence === 'v1' || a.vence === 'v3')) open.push('Tu contrato vence pronto: la renovación es una conversación que igual va a ocurrir.');
    if (m >= 9 && m <= 11) open.push('Es temporada de presupuestos: lo que se pide ahora puede entrar al del próximo año.');
    if (m >= 1 && m <= 3) open.push('Es temporada de evaluaciones y ajustes anuales.');
    if (a.empresa === 'crece') open.push('Tu empresa está creciendo.');
    if (closed.length) {
      const d = new Date(now.getFullYear(), now.getMonth() + closed[0].meses, 1);
      return { state: 'cerrado', label: 'Todavía no es el momento', text: closed[0].t, cuando: closed[0].cuando, mes: MONTHS_ES[d.getMonth()] };
    }
    if (open.length) return { state: 'abierto', label: 'Buen momento', text: open.slice(0, 2).join(' ') };
    return { state: 'neutro', label: 'Momento neutro', text: 'No hay nada en contra, pero tampoco un empuje claro: elige bien la fecha.' };
  }

  const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  // Toda recomendación dice cómo pedir; solo "esperar" pospone, y con fecha
  const VERDICTS = {
    pide_ahora:  { color: 'go',   stamp: 'Pide ahora', sub: 'Estás bajo el mercado, tu caso es sólido y el momento ayuda.' },
    pide_pronto: { color: 'go',   stamp: 'Pide en unas semanas', sub: 'Estás bajo el mercado y tienes caso. Prepara la conversación y elige bien la fecha.' },
    construye:   { color: 'go',   stamp: 'Pide en 8 semanas', sub: 'Estás bajo el mercado. Te falta evidencia, no razón: esta semana acuerdas metas con tu jefe y en ocho semanas pides con resultados en la mano.' },
    merito:      { color: 'go',   stamp: 'Pide por mérito', sub: 'Estás dentro del rango de tu perfil. Tu aumento se gana con resultados: llévalos con números y pide una cifra concreta.' },
    trato:       { color: 'go',   stamp: 'Pide un trato', sub: 'Estás en rango y todavía te falta evidencia. Pide hoy las metas que te llevarían a un aumento, con cifra y fecha de revisión por escrito.' },
    paquete:     { color: 'go',   stamp: 'Pide más que sueldo', sub: 'Ya estás sobre la mediana. Pide un ajuste moderado y amplía el paquete: bono por resultados, capacitación o horario.' },
    metas:       { color: 'wait', stamp: 'Pide metas primero', sub: 'Estás sobre la mediana y tu caso aún es débil. Pide hoy las metas y la fecha de tu próximo ajuste: el aumento llega con los resultados.' },
    esperar:     { color: 'wait', stamp: 'Pide en', sub: '' },
    mercado:     { color: 'wait', stamp: 'Negocia con el mercado', sub: 'Estás muy por debajo del mercado y adentro la puerta está cerrada. Tu mejor aumento puede ser una oferta de otra empresa.' }
  };

  function recommend(a, now = new Date()) {
    const r = { route: route(a) };
    if (r.route) return r;
    const t = total(a);
    r.total = t;
    r.band = band(a);
    r.pct = percentile(t, r.band);
    r.pos = position(r.pct);
    r.gap = gapRange(t, r.band);
    r.caso = caseScore(a, r.pos);
    r.momento = moment(a, now);
    let code;
    if (r.pct < 20 && (a.aumento === 'no' || a.empresa === 'recorta')) code = 'mercado';
    else if (r.momento.state === 'cerrado') code = 'esperar';
    else if (r.pos === 'bajo') code = r.caso.level === 'debil' ? 'construye' : (r.momento.state === 'abierto' ? 'pide_ahora' : 'pide_pronto');
    else if (r.pos === 'rango') code = r.caso.level === 'debil' ? 'trato' : 'merito';
    else code = r.caso.level === 'debil' ? 'metas' : 'paquete';
    const v = VERDICTS[code];
    r.code = code;
    r.color = v.color;
    r.stamp = code === 'esperar' ? `Pide en ${r.momento.mes}` : v.stamp;
    r.sub = code === 'esperar' ? r.momento.text + ' Desde hoy siembras: acuerda metas con tu jefe y junta resultados con números para llegar con caso.' : v.sub;
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

  // Factor anual según el régimen: general o REMYPE (pequeña y microempresa)
  function annualFactor(regime) {
    if (regime === 'micro') return CONFIG.annualFactorMicro;
    if (regime === 'pequena') return CONFIG.annualFactorSmall;
    return CONFIG.annualFactor;
  }

  // Cifras del kit: ancla (lo que dices), objetivo (lo que esperas) y piso (lo que aceptas),
  // sobre el sueldo fijo. La posición se mide con el total (fijo + variable), como el mercado.
  function numbers(a, r) {
    const s = Number(a.sueldo) || 0, v = Number(a.variable) || 0, t = s + v, b = r.band;
    const pretFrom = round100(Math.max(b.p50, s * 1.10));
    const out = {
      anchor: null, target: null, floor: null, annual: null,
      pretFrom, pretTo: round100(Math.max(b.p75, s * 1.25, pretFrom * 1.08))
    };
    const asksRaise = ['pide_ahora', 'pide_pronto', 'construye', 'merito', 'trato', 'paquete', 'esperar', 'mercado'].includes(r.code);
    if (!asksRaise) return out;
    const cap = s * (1 + CONFIG.capNoPromotion);
    let target, anchor, floor;
    if (r.pos === 'bajo') {
      // La brecha se mide con el total, pero el objetivo sube a lo sumo 15% el fijo
      target = Math.min(s + (Math.min(b.p50, t * 1.15) - t), s * 1.15);
      anchor = Math.min(Math.max(target * 1.05, target), cap);
      floor = Math.max(s * 1.05, s + (target - s) * 0.5);
    } else if (r.pos === 'rango') {
      target = s * 1.08;
      anchor = s * 1.12;
      floor = s * 1.04;
    } else {
      // Sobre la mediana: ajuste moderado, cerca de lo que suben las empresas este año
      target = s * 1.05;
      anchor = s * 1.08;
      floor = s * 1.03;
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
    out.pctAnchor = Math.round((anchor / s - 1) * 1000) / 10;
    out.pctTarget = Math.round((target / s - 1) * 1000) / 10;
    out.annual = Math.round((target - s) * CONFIG.annualFactor / 10) * 10;
    out.annualSmall = Math.round((target - s) * CONFIG.annualFactorSmall / 10) * 10;
    out.annualMicro = Math.round((target - s) * CONFIG.annualFactorMicro / 10) * 10;
    const gap = anchor - target;
    const ladder = [anchor];
    if (gap >= 30) {
      ladder.push(precise(anchor - gap * 2 / 3));
      ladder.push(target);
      ladder.push(Math.max(precise(target - gap / 6), precise(floor + 10)));
    } else {
      ladder.push(Math.max(precise(target - 20), precise(floor + 10)));
    }
    out.ladder = ladder.filter((x, i, arr) => i === 0 || (x < arr[i - 1] && x >= floor));
    return out;
  }

  /* ---------- Bruto y neto (régimen general, 2026) ---------- */
  function incomeTaxAnnual(gross) {
    const T = MARKET.context.tributos_2026;
    let base = gross * 14.18 - T.deduccion_uit * T.uit; // 12 sueldos + 2 gratificaciones + bonificación extraordinaria
    if (base <= 0) return 0;
    let tax = 0, prev = 0;
    for (const [upTo, rate] of T.tramos_quinta) {
      const top = upTo == null ? Infinity : upTo * T.uit;
      const slice = Math.min(base, top) - prev;
      if (slice <= 0) break;
      tax += slice * rate;
      prev = top;
    }
    return tax;
  }
  // Neto mensual aproximado: AFP con comisión mixta (10% + prima de seguro) u ONP, y retención de quinta
  function netFromGross(gross, system) {
    const T = MARKET.context.tributos_2026;
    const pension = system === 'onp'
      ? gross * T.onp
      : gross * T.afp_aporte + Math.min(gross, T.afp_tope_prima) * T.afp_prima;
    return gross - pension - incomeTaxAnnual(gross) / 12;
  }
  function grossFromNet(net, system) {
    if (!(net > 0)) return 0;
    let lo = net, hi = net * 2;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (netFromGross(mid, system) < net) lo = mid; else hi = mid;
    }
    return Math.round((lo + hi) / 2);
  }

  // ¿El sueldo escrito se ve raro para el perfil? (anual, en dólares, neto con variable, etc.)
  function salaryCheck(a) {
    const s = Number(a.sueldo) || 0;
    if (!s || !a.nivel || !a.puesto) return null;
    const b = band(a);
    if (s > b.p75 * 4) return 'Ese monto es muy alto para tu perfil. Revisa que sea tu sueldo mensual, no anual, y que esté en soles.';
    return null;
  }

  // Registro anónimo de un test para retroalimentar el modelo: sin nombre, DNI, empresa ni fecha exacta
  const RECORD_FIELDS = ['puesto', 'nivel', 'sector', 'region', 'tamano', 'campo', 'contrato', 'vence', 'experiencia', 'antiguedad', 'aumento', 'funciones', 'logros', 'empresa'];
  function responseRecord(a, r, now = new Date()) {
    const rec = { schema: 1, id: a._rid || null, mes: now.toISOString().slice(0, 7), modelo: MARKET.version };
    RECORD_FIELDS.forEach(k => { if (a[k] != null && a[k] !== '') rec[k] = a[k]; });
    rec.sueldo = Number(a.sueldo) || 0;
    rec.variable = Number(a.variable) || 0;
    if (r && !r.route) { rec.p50 = r.band.p50; rec.pct = r.pct; rec.code = r.code; }
    return rec;
  }

  return { band, factors, ownKey, responseRecord, confidence, percentile, gapRange, position, caseScore, moment, recommend, numbers, route, round50, round100, precise, annualFactor, netFromGross, grossFromNet, incomeTaxAnnual, salaryCheck, inflationSince, total };
})();
