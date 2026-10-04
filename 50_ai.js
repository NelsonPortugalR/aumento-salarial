/* ============================================================
   IA OPCIONAL Y SIMULADOR
   La IA solo redacta. Las cifras y la recomendación salen del motor.
   ============================================================ */
function aiErrorCopy(e) {
  const code = e && e.code;
  if (code === 'cancelled') return 'Detenido. Tu kit sigue igual.';
  if (code === 'rate_limited') return 'Demasiadas solicitudes por ahora. Intenta de nuevo en un rato.';
  if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed')
    return 'La IA no está disponible en esta vista. Tu kit funciona igual sin ella.';
  if (code === 'session_expired') return 'Tu sesión expiró. Vuelve a iniciar sesión para usar la IA.';
  if (code === 'invalid_json') return 'La respuesta llegó incompleta. Intenta de nuevo.';
  return 'No se pudo completar. Intenta de nuevo.';
}
function aiPermanentFailure(e) {
  return e && ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e.code);
}

function profileLines() {
  const a = S.answers;
  const lab = (arr, id) => (byId(arr, id) || {}).label || 'sin dato';
  return [
    `Puesto: ${lab(ROLES, a.puesto)}, nivel ${lab(LEVELS, a.nivel).toLowerCase()}.`,
    `Sector: ${lab(SECTORS, a.sector)}. Región: ${lab(REGIONS, a.region)}${a.campo ? ', trabaja en unidad, obra o campo' : ''}. Empresa de ${lab(SIZES, a.tamano).toLowerCase()} personas.`,
    `Contrato: ${lab(CONTRACTS, a.contrato).toLowerCase()}${a.contrato === 'plazo' ? ', vence ' + lab(EXPIRY, a.vence).toLowerCase() : ''}.`,
    `Tiempo en el puesto: ${lab(TENURE, a.antiguedad).toLowerCase()}. Último aumento: ${lab(LASTRAISE, a.aumento).toLowerCase()}. Funciones nuevas: ${lab(FUNCTIONS, a.funciones).toLowerCase()}. Empresa: ${lab(COMPANY, a.empresa).toLowerCase()}.`
  ].join('\n');
}

/* ---------- Personalizar el kit ---------- */
function polishPrompt() {
  const k = S.kit, kin = S.kitIn || {}, n = k.numbers;
  const usted = kin.trato === 'usted';
  const style = (byId(BOSS_STYLES, kin.estilo) || {}).desc || 'sin dato';
  const approver = (byId(APPROVERS, kin.aprueba) || {}).label || 'sin dato';
  const r = Engine.recommend(S.answers, new Date());
  const cifras = k.raise
    ? `Cifra a pedir: ${Kit.money(n.anchor)}. Objetivo: ${Kit.money(n.target)}. Piso: ${Kit.money(n.floor)}. En el pedido se dice solo la cifra a pedir.`
    : 'No se pide aumento de base: se pide un proyecto con metas, una capacitación o un bono, y una revisión del sueldo en seis meses.';
  const objs = k.objections.map(o => `- id "${o.id}": "${o.q}" Respuesta actual: ${o.reply}`).join('\n');
  return `Eres un coach de negociación salarial en Perú. Reescribe partes de este kit para que suenen naturales, concretas y personales, en español peruano neutro, con frases cortas que se puedan decir en voz alta.

Perfil del colaborador:
${profileLines()}
Recomendación del motor: ${r.stamp}. Posición frente al mercado: ${r.pos === 'bajo' ? 'por debajo de la mediana' : r.pos === 'rango' ? 'dentro del rango' : 'sobre la mediana'}.
Logro 1: ${kin.logro1 || 'no indicado'}
Logro 2: ${kin.logro2 || 'no indicado'}
Lo que ganó la empresa: ${kin.impacto || 'no indicado'}
Plan para los próximos seis meses: ${kin.plan || 'no indicado'}
Responsabilidades nuevas: ${kin.responsabilidades || 'no indicadas'}
Quién aprueba los aumentos: ${approver}. Estilo del jefe: ${style}.

Reglas obligatorias:
- ${cifras} No cambies ninguna cifra ni inventes otras.
- Dirígete al jefe ${usted ? 'de usted' : 'de tú'} en todos los textos.
- El WhatsApp solo pide una reunión de 20 minutos y ofrece dos opciones: el ${k.days[0]} en la mañana o el ${k.days[1]} en la tarde. No negocia por chat ni menciona cifras.
- Una sola cifra, nunca un rango. Nada de deudas, comparaciones con compañeros, ultimátums ni disculpas.
- Si un logro no fue indicado, deja un espacio entre corchetes para que la persona lo complete.
- El speech completo debe poder decirse en 60 a 90 segundos. Sigue esta lógica: entusiasmo por la empresa y aporte, resultados con números, un plan de lo que viene, dato de mercado, una cifra concreta y cierre con fecha.
- El pedido se presenta como propuesta de valor para la empresa, no como necesidad personal.
- El speech abre adelantándose a las dudas del jefe ("quizá pienses que…") antes de hablar del aporte.
- En las objeciones, empieza con una etiqueta ("parece que…", "suena a que…") y sigue con una pregunta de "qué" o "cómo". Nunca uses "¿por qué?". Mantén la doble alternativa de fechas cuando ya esté.

Reescribe la respuesta de estas objeciones, manteniendo cada id:
${objs}

Texto actual de referencia:
WhatsApp: ${k.whatsapp}
Speech: ${k.speech.auditoria || ''} ${k.speech.apertura} ${k.speech.prueba} ${k.speech.plan || ''} ${k.speech.mercado} ${k.speech.pedido} ${k.speech.cierre}
Correo: ${k.email}

Responde solo con JSON con esta forma exacta:
{"whatsapp": "texto", "speech": {"auditoria": "texto", "apertura": "texto", "prueba": "texto", "plan": "texto", "mercado": "texto", "pedido": "texto", "cierre": "texto"}, "objeciones": [{"id": "presupuesto", "responder": "texto"}], "correo": "texto con saltos de línea"}`;
}

function applyPolish(d) {
  if (!d || typeof d !== 'object' || !d.speech || typeof d.speech !== 'object') return false;
  const k = S.kit;
  const str = v => typeof v === 'string' && v.trim().length > 0 && v.length < 2000;
  let changed = 0;
  if (str(d.whatsapp)) { k.whatsapp = d.whatsapp.trim(); changed++; }
  ['auditoria', 'apertura', 'prueba', 'plan', 'mercado', 'pedido', 'cierre'].forEach(key => { if (str(d.speech[key])) { k.speech[key] = d.speech[key].trim(); changed++; } });
  if (Array.isArray(d.objeciones)) {
    d.objeciones.forEach(o => {
      if (!o || !str(o.responder)) return;
      const t = k.objections.find(x => x.id === o.id);
      if (t) { t.reply = o.responder.trim(); changed++; }
    });
  }
  if (str(d.correo)) { k.email = d.correo.trim(); changed++; }
  return changed >= 3;
}

async function polishKit() {
  if (!RT.sample || RT.busy || !S.kit) return;
  const st = $('#ai-status');
  RT.busy = true;
  RT.ctl = new AbortController();
  syncCapabilityUI();
  const stop = $('#stop-ai'); if (stop) stop.hidden = false;
  if (st) st.textContent = 'Personalizando tu kit. Puede tardar hasta un minuto.';
  try {
    const data = await RT.sample.json(polishPrompt(), { signal: RT.ctl.signal, modelTier: 'default', cache: false });
    if (applyPolish(data)) {
      S.polished = true;
      RT.busy = false; RT.ctl = null;
      render();
      return;
    }
    if (st) st.textContent = 'La respuesta no tuvo el formato esperado. Tu kit sigue igual; intenta de nuevo.';
  } catch (e) {
    if (st) st.textContent = aiErrorCopy(e);
    if (aiPermanentFailure(e)) RT.sample = null;
  } finally {
    if (RT.busy) { RT.busy = false; RT.ctl = null; }
    const s2 = $('#stop-ai'); if (s2) s2.hidden = true;
    syncCapabilityUI();
  }
}

/* ---------- Simulador ---------- */
const SCRIPT = {
  analitico: [
    { line: 'Interesante. ¿En qué datos te basas para pedir eso?', model: k => `${k.speech.prueba} ${k.speech.mercado}` },
    { line: 'Entiendo, pero este año el presupuesto de personal ya está cerrado.', obj: 'presupuesto' },
    { line: 'Además, tu sueldo está dentro de la banda que manejamos para tu puesto.', obj: 'banda' },
    { line: 'Podría ver un bono por resultados a fin de año, pero el sueldo base se queda igual.', obj: 'bono' }
  ],
  cercano: [
    { line: 'Sabes que te valoramos mucho y que eres clave en el equipo.', model: k => `Gracias, me alegra escucharlo. Justamente porque quiero seguir aportando, me gustaría que mi sueldo lo refleje. ${k.speech.pedido}` },
    { line: 'El tema es que ahora la situación no está para aumentos; gerencia está ajustando.', obj: 'presupuesto' },
    { line: '¿Por qué no lo vemos en la evaluación? Ahí todo es más ordenado.', obj: 'evaluacion' },
    { line: 'Mira, te puedo dar un bono ahora, pero el sueldo es más difícil de mover.', obj: 'bono' }
  ],
  directo: [
    { line: 'Ok. ¿Cuánto quieres y por qué?', model: k => k.raise ? `Propongo un ajuste a ${Kit.money(k.numbers.anchor)} mensuales, por dos razones. ${k.speech.prueba}` : `${k.speech.pedido} ${k.speech.prueba}` },
    { line: 'No hay presupuesto. Así de simple.', obj: 'presupuesto' },
    { line: 'Todos en tu puesto ganan lo mismo. Si te subo a ti, tengo que subir a todos.', obj: 'banda' },
    { line: '¿Me estás diciendo que te vas si no te subimos?', obj: 'ultimatum' }
  ],
  evasivo: [
    { line: 'Ya, ya, entiendo. Justo ahorita estamos con mil cosas.', obj: 'momento', model: k => `Entiendo. Por eso prefiero dejar una fecha: ¿lo vemos con calma el ${k.days[0]} o el ${k.days[1]}?` },
    { line: 'Pásamelo por escrito y lo vemos con calma.', obj: 'escrito' },
    { line: 'Eso igual lo decide gerencia, no depende de mí.', obj: 'gerencia' },
    { line: 'Mejor lo vemos más adelante, ¿te parece?', model: k => `Claro. Para no dejarlo en el aire, ¿fijamos una fecha? ¿El ${k.days[0]} de la próxima semana o el ${k.days[1]}?` }
  ],
  duro: [
    { line: 'No. Este año no hay aumentos.', obj: 'presupuesto' },
    { line: 'Te entiendo, pero la respuesta sigue siendo no.', model: k => `Lo entiendo. Entonces ayúdame a ver qué tendría que pasar para llegar ahí: ¿qué metas tendría que cumplir y en qué plazo? Si las cumplo, ¿lo revisamos en ${k.reviewMonth}?` },
    { line: 'Todavía no estás en ese nivel.', obj: 'nivel' },
    { line: '¿Algo más?', model: k => `Sí: ¿podemos dejar por escrito las metas y la fecha de revisión que acabamos de hablar? Hoy mismo ${k.trato === 'usted' ? 'le' : 'te'} envío un correo con el resumen.` }
  ]
};
const RE_DATE = /(lunes|martes|mi[eé]rcoles|jueves|viernes|semana|mes|enero|febrero|marzo|abril|mayo|junio|julio|agosto|se[pt]tiembre|octubre|noviembre|diciembre|fecha|cu[aá]ndo|revis|pr[oó]xim)/i;
const RE_BAD = /(deuda|pr[eé]stamo|mis gastos|necesito la plata|compa[nñ]er|gana m[aá]s que yo|me voy|renuncio|perd[oó]n|disculp)/i;
const RE_VALUE = /(logr|result|reduj|aument|ahorr|proyecto|cliente|equipo|responsab|%|lider|supervis|cerr|implement|automatic|venta|meta)/i;
const RE_ASK = /(propon|ajuste|aumento|revis|sueldo|remuneraci|s\/|\d)/i;
const RE_LABEL = /(parece que|suena a que|da la impresi[oó]n|pareciera que|me imagino que|entiendo que)/i;
const RE_CALIB = /¿\s*(c[oó]mo|qu[eé]|cu[aá]ndo|cu[aá]l)\b/i;
const RE_WHY = /¿\s*por\s*qu[eé]/i;
const RE_HEDGE = /\b(creo|siento|pienso|s[oó]lo|un poquito|ser[ií]a justo|podr[ií]a ser)\b/i;
const RE_AUDIT = /(quiz[aá]|seguramente|antes de empezar|s[eé] que|pienses|piense|puede parecer)/i;

function checksFor(text, opening) {
  const t = String(text || '');
  const list = opening
    ? [
        { ok: RE_VALUE.test(t), good: 'Abriste con tu aporte', bad: 'Abre con lo que aportas, no con lo que necesitas' },
        { ok: /\d/.test(t), good: 'Usaste una cifra o un dato', bad: 'Falta una cifra: tu propuesta o un resultado con número' },
        { ok: RE_ASK.test(t), good: 'Hiciste un pedido claro', bad: 'Haz el pedido de forma explícita' },
        { ok: !RE_BAD.test(t), good: 'Evitaste deudas, comparaciones y amenazas', bad: 'Evita deudas, comparaciones con compañeros, amenazas o disculpas' },
        { ok: !RE_HEDGE.test(t), good: 'Hablaste con seguridad', bad: 'Quita "creo", "siento", "solo" o "sería justo": afirma con "propongo" y "mis resultados muestran"' },
        { ok: RE_AUDIT.test(t), good: 'Te adelantaste a sus dudas', bad: 'Prueba adelantarte a sus dudas: "quizá pienses que no es el mejor momento…"' }
      ]
    : [
        { ok: t.trim().length > 30 && !/^(ok|ya|bueno|entiendo|est[aá] bien|de acuerdo|claro)[\s.,!]*$/i.test(t.trim()), good: 'No cediste de inmediato', bad: 'No cedas a la primera: responde con un argumento' },
        { ok: RE_LABEL.test(t) || RE_CALIB.test(t), good: 'Etiquetaste o preguntaste "qué" o "cómo"', bad: 'Prueba etiquetar ("parece que…") o preguntar "¿cómo podríamos…?"' },
        { ok: RE_DATE.test(t), good: 'Llevaste la conversación a una fecha o un siguiente paso', bad: 'Cierra con una fecha o un siguiente paso concreto' },
        { ok: !RE_BAD.test(t) && !RE_WHY.test(t), good: 'Evitaste deudas, comparaciones, amenazas y el "¿por qué?"', bad: 'Evita deudas, comparaciones, amenazas, disculpas y el "¿por qué?"' }
      ];
  return list;
}

function bossRules() {
  const a = S.answers, k = S.kit, kin = S.kitIn || {};
  const style = (byId(BOSS_STYLES, S.sim.style) || BOSS_STYLES[1]).desc;
  const ask = k.raise ? `va a pedir un ajuste a ${Kit.money(k.numbers.anchor)} mensuales (hoy gana ${Kit.money(Number(a.sueldo))})` : 'va a pedir crecer: un proyecto, capacitación y una revisión de su sueldo en seis meses';
  return `Vas a interpretar al jefe en un ensayo de negociación salarial en una empresa peruana. Estilo del jefe: ${style}.
Perfil del colaborador:
${profileLines()}
El colaborador ${ask}.
Reglas: responde solo como el jefe, en español peruano natural y cotidiano, en 1 a 3 oraciones y tratando al colaborador de tú. Si tu estilo es duro, di que no al menos tres veces antes de considerar algo. Si el colaborador nombra tus preocupaciones ("parece que…") o te pregunta "¿cómo…?" o "¿qué…?", te ablandas un poco y das información; si te presiona o te pregunta "¿por qué?", te pones a la defensiva. Pon objeciones realistas de una en una, según tu estilo: presupuesto, esperar la evaluación, banda salarial, un bono en vez de aumento, que lo decide gerencia. No aceptes de inmediato: cede poco a poco solo si el colaborador argumenta con resultados, sostiene una cifra concreta y propone una fecha. Nunca salgas del personaje, nunca des consejos y no uses comillas.${kin.aprueba && kin.aprueba !== 'jefe' ? ' Recuerda que la aprobación final la tiene ' + ((byId(APPROVERS, kin.aprueba) || {}).label || '').toLowerCase() + '.' : ''}`;
}

function simTurnsForAI() {
  const turns = [];
  let first = true;
  S.sim.turns.forEach(t => {
    if (t.role === 'me') {
      turns.push({ role: 'user', content: first ? `${bossRules()}\n\nEl colaborador abre la reunión y dice:\n${t.text}` : t.text });
      first = false;
    } else if (t.role === 'boss') {
      turns.push({ role: 'assistant', content: t.text });
    }
  });
  return turns;
}

function simHTML() {
  const sim = S.sim;
  const intro = `<h2>Practica antes de la reunión</h2>`;
  if (!sim) {
    const cur = (S.kitIn && S.kitIn.estilo) || 'cercano';
    return `${intro}
      <p>Tu jefe responde según su estilo. Tú abres la reunión, haces tu pedido y manejas sus objeciones.</p>
      <div class="field"><span>Estilo de tu jefe</span><div class="chips">${BOSS_STYLES.map(o => `<button type="button" class="chip${cur === o.id ? ' is-on' : ''}" data-action="sim-style" data-value="${o.id}" aria-pressed="${cur === o.id}">${esc(o.label)}</button>`).join('')}</div></div>
      <button type="button" class="btn" data-action="sim-start" data-mode="ia" data-needs="sample" hidden>Empezar la práctica con IA</button>
      <button type="button" class="btn-ghost" data-action="sim-start" data-mode="guiada">Empezar la práctica guiada</button>
      <p class="fine" data-needs="sample" hidden>Con IA, tu jefe responde libremente. La práctica guiada usa objeciones fijas y te muestra una respuesta modelo después de cada turno.</p>`;
  }
  const label = sim.mode === 'ia' ? 'Práctica con IA' : 'Práctica guiada';
  const bubbles = sim.turns.map(t => {
    if (t.role === 'me') return `<div class="bubble me"><span class="who">Tú</span>${esc(t.text)}</div>`;
    if (t.role === 'boss') return `<div class="bubble boss"><span class="who">Tu jefe</span>${esc(t.text)}</div>`;
    const checks = (t.checks || []).map(c => `<p class="${c.ok ? 'ok' : 'no'}">${esc(c.ok ? c.good : c.bad)}</p>`).join('');
    const model = t.model ? `<p><span class="label">Una respuesta modelo:</span> ${esc(t.model)}</p>` : '';
    return `<div class="coach">${t.text ? `<p>${esc(t.text)}</p>` : ''}${checks}${model}</div>`;
  }).join('');
  const pending = sim.pending ? `<div class="bubble boss" id="sim-pending"><span class="who">Tu jefe</span>${esc(RT.simText || 'Escribiendo…')}</div>` : '';
  const myTurns = sim.turns.filter(t => t.role === 'me').length;
  let foot = '';
  if (sim.done) {
    foot = feedbackHTML(sim.feedback) + `<button type="button" class="btn-ghost" data-action="sim-reset">Practicar de nuevo</button>`;
  } else {
    foot = `<div class="composer">
        <label class="small-label" for="sim-input">${myTurns === 0 ? 'Abre la reunión y haz tu pedido, como lo dirías en voz alta' : 'Tu respuesta'}</label>
        <textarea id="sim-input" ${sim.pending ? 'disabled' : ''}></textarea>
        <button type="button" class="btn" data-action="sim-send" ${sim.pending ? 'disabled' : ''}>Responder</button>
        ${sim.mode === 'ia' && myTurns >= 2 ? `<button type="button" class="btn-ghost" data-action="sim-finish" ${sim.pending ? 'disabled' : ''}>Terminar y ver mi evaluación</button>` : ''}
        ${sim.pending ? '<button type="button" class="link" data-action="stop-ai">Detener</button>' : ''}
      </div>
      <p class="status" id="sim-status" role="status">${esc(sim.status || '')}</p>`;
  }
  return `${intro}<p class="fine">${label}. Estilo: ${esc((byId(BOSS_STYLES, sim.style) || {}).label || '')}.</p><div class="chat">${bubbles}${pending}</div>${foot}`;
}

function feedbackHTML(f) {
  if (!f) return '';
  return `<div class="say feedback">
      <p class="score">${esc(f.puntaje)}<span class="fine"> de 10</span></p>
      ${f.bien && f.bien.length ? `<p class="label">Lo que hiciste bien</p><ul class="plain">${f.bien.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${f.mejorar && f.mejorar.length ? `<p class="label">Para la próxima</p><ul class="plain">${f.mejorar.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${f.frase ? `<p><span class="label">Prueba decir:</span> ${esc(f.frase)}</p>` : ''}
    </div>`;
}

function refreshSim() {
  const box = $('#sim');
  if (!box) return;
  box.innerHTML = simHTML();
  syncCapabilityUI();
}

function simSetStyle(id) {
  if (!S.kitIn) S.kitIn = {};
  S.kitIn.estilo = id;
  save();
  refreshSim();
}

function simStart(mode) {
  const useAI = mode === 'ia' && !!RT.sample;
  const style = (S.kitIn && S.kitIn.estilo) || 'cercano';
  S.sim = { mode: useAI ? 'ia' : 'guiada', style, turns: [], bossIdx: 0, done: false, pending: false, feedback: null, status: '' };
  S.sim.turns.push({ role: 'coach', text: 'Empieza tú: abre la reunión con tu aporte y haz tu pedido.' });
  save();
  refreshSim();
  const inp = $('#sim-input'); if (inp) inp.focus();
}

async function simSend() {
  const sim = S.sim;
  const inp = $('#sim-input');
  if (!sim || sim.pending || !inp) return;
  const text = inp.value.trim().slice(0, 1200);
  if (!text) return;
  const opening = sim.turns.filter(t => t.role === 'me').length === 0;
  sim.turns.push({ role: 'me', text });
  if (sim.mode === 'guiada') {
    const script = SCRIPT[sim.style] || SCRIPT.cercano;
    const checks = checksFor(text, opening);
    let model = null;
    if (!opening) {
      const prev = script[sim.bossIdx - 1];
      const o = prev && prev.obj ? S.kit.objections.find(x => x.id === prev.obj) : null;
      model = o ? o.reply : (prev && prev.model ? prev.model(S.kit) : null);
    }
    sim.turns.push({ role: 'coach', text: '', checks, model });
    sim.allChecks = (sim.allChecks || []).concat(checks);
    if (sim.bossIdx < script.length) {
      sim.turns.push({ role: 'boss', text: script[sim.bossIdx].line });
      sim.bossIdx++;
    } else {
      sim.done = true;
      sim.feedback = guidedFeedback(sim.allChecks);
    }
    save();
    refreshSim();
    const ni = $('#sim-input'); if (ni) ni.focus();
    return;
  }
  // Modo IA
  sim.pending = true; sim.status = '';
  RT.simText = '';
  RT.ctl = new AbortController();
  save(); refreshSim();
  try {
    const res = await RT.sample(simTurnsForAI(), {
      cache: false, modelTier: 'quick', signal: RT.ctl.signal,
      onText: ({ text: t }) => { RT.simText = t; const p = $('#sim-pending'); if (p) p.innerHTML = '<span class="who">Tu jefe</span>' + esc(t); }
    });
    sim.turns.push({ role: 'boss', text: res.text.trim() });
  } catch (e) {
    if (e && e.text) sim.turns.push({ role: 'boss', text: e.text.trim() });
    sim.status = aiErrorCopy(e);
    if (aiPermanentFailure(e)) { RT.sample = null; sim.mode = 'guiada'; sim.status += ' Seguimos en práctica guiada.'; }
  } finally {
    sim.pending = false; RT.ctl = null; RT.simText = '';
    save(); refreshSim();
    const ni = $('#sim-input'); if (ni) ni.focus();
  }
}

function guidedFeedback(checks) {
  const total = checks.length || 1;
  const okCount = checks.filter(c => c.ok).length;
  const uniq = arr => Array.from(new Set(arr));
  return {
    puntaje: Math.round(okCount / total * 10),
    bien: uniq(checks.filter(c => c.ok).map(c => c.good)).slice(0, 3),
    mejorar: uniq(checks.filter(c => !c.ok).map(c => c.bad)).slice(0, 3),
    frase: S.kit.speech.cierre
  };
}

async function simFinish() {
  const sim = S.sim;
  if (!sim || sim.pending) return;
  if (sim.mode !== 'ia' || !RT.sample) { sim.done = true; sim.feedback = guidedFeedback(sim.allChecks || []); save(); refreshSim(); return; }
  sim.pending = true; sim.status = 'Preparando tu evaluación…';
  RT.ctl = new AbortController();
  save(); refreshSim();
  const transcript = sim.turns.filter(t => t.role !== 'coach').map(t => (t.role === 'me' ? 'Colaborador: ' : 'Jefe: ') + t.text).join('\n');
  const k = S.kit;
  const target = k.raise ? `una cifra concreta (${Kit.money(k.numbers.anchor)})` : 'un proyecto con metas y una revisión de sueldo en seis meses';
  const prompt = `Evalúa el desempeño del colaborador (no del jefe) en este ensayo de negociación salarial en Perú.
Criterios: se adelantó a las dudas del jefe al abrir; habló con seguridad, sin muletillas como "creo", "siento" o "solo"; abrió con su aporte; usó resultados con números; pidió ${target}; ante las objeciones usó etiquetas ("parece que…") y preguntas de "qué" o "cómo" en vez de "¿por qué?"; no partió la diferencia ni cedió de inmediato; cerró con una fecha o un siguiente paso; evitó hablar de deudas, compararse con compañeros, amenazar o disculparse.
Transcripción:
${transcript}

Responde solo con JSON con esta forma: {"puntaje": 0, "bien": ["frase corta"], "mejorar": ["frase corta"], "frase": "una frase que el colaborador podría usar la próxima vez"}. "puntaje" es un entero de 0 a 10; máximo 3 elementos por lista; habla al colaborador de tú.`;
  try {
    const f = await RT.sample.json(prompt, { cache: false, modelTier: 'default', signal: RT.ctl.signal });
    const okArr = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 3) : [];
    sim.feedback = { puntaje: Math.max(0, Math.min(10, Math.round(Number(f && f.puntaje) || 0))), bien: okArr(f && f.bien), mejorar: okArr(f && f.mejorar), frase: f && typeof f.frase === 'string' ? f.frase : '' };
    sim.done = true; sim.status = '';
  } catch (e) {
    sim.status = aiErrorCopy(e);
    if (aiPermanentFailure(e)) RT.sample = null;
  } finally {
    sim.pending = false; RT.ctl = null;
    save(); refreshSim();
  }
}

/* ---------- Arranque ---------- */
load();
if (S.sim && S.sim.pending) S.sim.pending = false;
render();
initRuntime();
