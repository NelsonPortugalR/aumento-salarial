/* ============================================================
   INTERFAZ
   ============================================================ */
const STORE_KEY = 'pidelo-bien-v1';
const FRESH = () => ({ view: 'test', stepId: 'puesto', answers: {}, consent: false, kitIn: null, kitDraft: null, kit: null, polished: false, sim: null });
const S = Object.assign(FRESH(), { unlocked: false });
const RT = { sample: null, downloads: null, isOwner: false, busy: false, ctl: null, landed: false, userActed: false, simText: '' };

const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const soles = n => 'S/\u00A0' + Math.round(n).toLocaleString('en-US');
const soles2 = n => 'S/\u00A0' + Number(n).toFixed(2);
const lowerFirstUI = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* almacenamiento no disponible */ } }
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && typeof d === 'object') Object.assign(S, d);
  } catch (e) { /* ignorar */ }
}
function resetTest() {
  const keepUnlock = S.unlocked;
  Object.assign(S, FRESH(), { unlocked: keepUnlock });
  RT.landed = false;
  render();
  window.scrollTo(0, 0);
}

const visibleSteps = () => STEPS.filter(s => !s.when || s.when(S.answers));
const needsField = a => ['mineria', 'construccion', 'agro'].includes(a.sector) || ['ing_minas', 'ing_civil', 'seguridad'].includes(a.puesto);
const salaryOk = () => S.consent && Number(S.answers.sueldo) >= 500 && Number(S.answers.sueldo) <= 150000;

/* ---------- Render ---------- */
function render() {
  if (S.view === 'result' && !S.answers.sueldo && !Engine.route(S.answers)) S.view = 'test';
  if ((S.view === 'interview' || S.view === 'kit') && !S.unlocked) S.view = 'result';
  let html;
  if (S.view === 'exit') html = viewExit();
  else if (S.view === 'result') html = viewResult();
  else if (S.view === 'interview') html = viewInterview();
  else if (S.view === 'kit') html = viewKit();
  else html = viewTest();
  $('#app').innerHTML = html;
  syncCapabilityUI();
  save();
}

function viewTest() {
  const steps = visibleSteps();
  let idx = steps.findIndex(s => s.id === S.stepId);
  if (idx < 0) { idx = 0; S.stepId = steps[0].id; }
  const step = steps[idx];
  const hero = idx === 0
    ? `<section class="hero"><h1>¿Te sumaron funciones y el sueldo sigue igual?</h1><p class="lede">En 90 segundos sabes si estás bajo el mercado, si es buen momento para pedir y por cuánto.</p></section>`
    : '';
  const bars = steps.map((s, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('');
  const body = step.type === 'salary' ? salaryBlock() : optionsBlock(step);
  const back = idx > 0 ? '<button type="button" class="link" data-action="back">Atrás</button>' : '<span></span>';
  const trust = idx === 0 ? '<p class="fine">Gratis y anónimo. No pedimos nombre, DNI ni empresa.</p>' : '';
  return `${hero}<section class="q" aria-labelledby="q-title">
    <div class="progress" aria-hidden="true">${bars}</div>
    <p class="count">${idx + 1} de ${steps.length}</p>
    <h2 id="q-title" tabindex="-1">${esc(step.title)}</h2>
    ${body}
    <div class="q-foot">${back}</div>
    ${trust}
  </section>`;
}

function optionsBlock(step) {
  const cur = S.answers[step.id];
  const extra = (step.id === 'region' && needsField(S.answers))
    ? `<label class="check"><input type="checkbox" data-field="campo" ${S.answers.campo ? 'checked' : ''}><span>Trabajo en unidad minera, obra o campo</span></label>`
    : '';
  const cls = step.type === 'grid' ? 'opts grid' : 'opts';
  const opts = step.options.map(o => `<button type="button" class="opt${cur === o.id ? ' is-on' : ''}" role="radio" aria-checked="${cur === o.id}" data-action="pick" data-step="${step.id}" data-value="${o.id}">${esc(o.label)}</button>`).join('');
  return `${extra}<div class="${cls}" role="radiogroup" aria-labelledby="q-title">${opts}</div>`;
}

function salaryBlock() {
  const v = S.answers.sueldo || '';
  const vv = S.answers.variable || '';
  return `<label class="consent"><input type="checkbox" data-field="consent" ${S.consent ? 'checked' : ''}>
      <span>Acepto que se use mi sueldo para calcular mi resultado. Es un dato sensible y lo tratamos como tal. <button type="button" class="link inline" data-action="privacy">Cómo cuidamos tus datos</button></span></label>
    <div class="money"><span class="cur" aria-hidden="true">S/</span><input id="sueldo" data-field="sueldo" inputmode="numeric" autocomplete="off" placeholder="3500" value="${esc(v)}" aria-label="Sueldo bruto mensual en soles"></div>
    <p class="help">Antes de descuentos, sin gratificaciones ni bonos.</p>
    <label class="small-label" for="variable">¿Recibes comisiones o bonos cada mes? Promedio, opcional</label>
    <div class="money small"><span class="cur" aria-hidden="true">S/</span><input id="variable" data-field="variable" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(vv)}"></div>
    <p class="warn" id="sueldo-warn" ${salaryWarning() ? '' : 'hidden'}>${esc(salaryWarning())}</p>
    <button type="button" class="btn" data-action="salary-next" ${salaryOk() ? '' : 'disabled'}>Continuar</button>`;
}
function salaryWarning() {
  const s = Number(S.answers.sueldo);
  if (!s) return '';
  if (s < CONFIG.rmv) return `Si trabajas jornada completa, el mínimo legal es ${soles(CONFIG.rmv)} desde el 1 de octubre de 2026.`;
  return '';
}

/* ---------- Resultado ---------- */
function gapSentence(g) {
  const lo = g[0], hi = g[1];
  if (lo > 2) return `Estás entre ${lo}% y ${hi}% bajo la mediana de tu perfil.`;
  if (hi < -2) return `Estás entre ${-hi}% y ${-lo}% sobre la mediana de tu perfil.`;
  return 'Estás cerca de la mediana de tu perfil.';
}

function viewResult() {
  const a = S.answers;
  const r = Engine.recommend(a, new Date());
  if (r.route) { S.view = 'exit'; return viewExit(); }
  const n = Engine.numbers(a, r);
  const mini = Kit.build(a, r, n, { trato: 'tu' }, new Date());
  const date = new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  const landing = RT.landed ? '' : ' landing';
  RT.landed = true;
  const pos = Math.max(4, Math.min(96, r.pct));
  const conf = 'Confianza baja: es una banda preliminar estimada para tu puesto, nivel, sector, región y tamaño de empresa'
    + (r.band.otherRole ? '. Como elegiste "Otro puesto", tómala solo como referencia general.' : '.');
  const plus = r.caso.strength || 'Todavía nada claro. Tus logros con números pueden cambiarlo.';
  const obj = mini.objections[0];
  const waWords = mini.whatsapp.split(' ');
  const waVisible = esc(waWords.slice(0, 7).join(' '));
  const waBlur = esc(waWords.slice(7, 20).join(' '));
  const firstLine = esc(mini.speech.apertura.split(':').slice(-1)[0].trim());
  const preview = `<ul class="preview">
      <li>${mini.raise ? `Tu cifra para pedir: <span class="blur" aria-hidden="true">S/ 9,999</span>` : 'Qué pedir en vez de sueldo, ordenado para tu caso'}</li>
      <li>Tu plan en tres tiempos: antes, durante y después de la reunión</li>
      <li>Mensaje para pedir la reunión: “${waVisible} <span class="blur" aria-hidden="true">${waBlur}</span>”</li>
      <li>${mini.objections.length} objeciones resueltas, entre ellas “${esc(mini.objections[3].q.split('.')[0])}”</li>
      <li>Un simulador para practicar, incluso con un jefe que dice que no</li>
    </ul>`;
  const cta = S.unlocked
    ? `<button type="button" class="btn" data-action="go-kit">Ver mi kit</button>`
    : `<button type="button" class="btn" data-action="open-paywall">Desbloquear mi kit por ${soles2(CONFIG.price)}</button><p class="fine">Pago único. Tu cifra exacta, el speech, las objeciones y el simulador.</p>`;
  return `<section class="result">
    <div class="slip">
      <div class="slip-head"><span>Tu resultado</span><span>${esc(date)}</span></div>
      <div class="stamp ${r.color}${landing}" role="img" aria-label="Recomendación: ${esc(r.stamp)}">${esc(r.stamp)}</div>
      <p class="verdict">${esc(r.sub)}</p>
      <hr class="tear">
      <h3>Tu posición</h3>
      <div class="meter" role="img" aria-label="Tu sueldo está en el percentil ${r.pct} de tu perfil">
        <div class="marker" style="left:${pos}%"><span>Tú</span></div>
        <div class="track"><span class="zone z1"></span><span class="zone z2"></span><span class="zone z3"></span></div>
        <div class="zl"><span>Bajo</span><span>En rango</span><span>Alto</span></div>
      </div>
      <p>${esc(gapSentence(r.gap))}</p>
      <p class="fine">${esc(conf)}</p>
      <hr class="tear">
      <h3>El momento</h3>
      <p><span class="label">${esc(r.momento.label)}.</span> ${esc(r.momento.text)}</p>
      <hr class="tear">
      <h3>Tu caso</h3>
      <ul class="facts"><li class="plus"><span class="label">A favor:</span> ${esc(plus)}</li><li class="minus"><span class="label">En contra:</span> ${esc(r.caso.weakness)}</li></ul>
    </div>
    <section class="block">
      <h3>Una objeción que vas a escuchar</h3>
      <p class="quote">“${esc(obj.q)}”</p>
      <p><span class="label">Qué significa:</span> ${esc(obj.means)}</p>
      <p><span class="label">Qué responder:</span> ${esc(obj.reply)}</p>
    </section>
    <section class="locked">
      <h3>Tu kit para la reunión</h3>
      ${preview}
      ${cta}
    </section>
    <div class="row-actions">
      <button type="button" class="btn-ghost" data-action="share">Compartir mi resultado</button>
      <button type="button" class="link" data-action="restart">Hacer el test de nuevo</button>
    </div>
  </section>`;
}

/* ---------- Salidas honestas ---------- */
const EXITS = {
  publico: {
    title: 'Tu sueldo sale de una escala, no de una negociación',
    paras: [
      'En el sector público la remuneración la fijan normas y escalas, así que no se pide aumento uno a uno.',
      'Lo que sí mueve tu ingreso: concursos de ascenso, cambios de plaza o de régimen, y capacitaciones que suman en tu carrera.',
      'Esta herramienta está pensada para el sector privado. Si también trabajas en una empresa privada, haz el test con ese puesto.'
    ]
  },
  civil: {
    title: 'Tu jornal lo fija el convenio de construcción civil',
    paras: [
      'Los jornales de peón, oficial y operario se negocian cada año en el convenio colectivo del sector, no uno a uno.',
      'Lo que sí puedes revisar: que te paguen la categoría que realmente cumples y todos los conceptos del convenio.',
      'Si eres ingeniero, residente o personal administrativo de obra, tu caso sí aplica: vuelve y elige otro tipo de contrato.'
    ]
  },
  rxh: {
    title: 'Con recibos por honorarios no hay aumento: hay tarifa',
    paras: [
      'Si emites recibos, no pides un aumento: renegocias tu tarifa.',
      'Para igualar un sueldo en planilla, tu tarifa mensual debería ser alrededor de 28% más alta, solo para compensar las gratificaciones y la CTS que no recibes.',
      'Pronto agregamos un kit para renegociar tarifas. Y si trabajas con horario fijo y bajo las órdenes de un jefe, vale la pena consultar tu situación con un especialista laboral.'
    ]
  }
};

function viewExit() {
  const route = Engine.route(S.answers);
  const c = EXITS[route];
  if (!c) { S.view = 'test'; return viewTest(); }
  return `<section class="result">
    <div class="slip">
      <div class="slip-head"><span>Tu resultado</span><span>Sin kit para este caso</span></div>
      <h2 class="exit-title">${esc(c.title)}</h2>
      ${c.paras.map(p => `<p>${esc(p)}</p>`).join('')}
    </div>
    <button type="button" class="btn-ghost" data-action="fix-contract">Corregir mi tipo de contrato</button>
    <div class="row-actions"><button type="button" class="link" data-action="restart">Hacer el test de nuevo</button></div>
  </section>`;
}

/* ---------- Muro de pago ---------- */
function paywallHTML() {
  const hasPay = !!CONFIG.payUrl, hasWa = !!CONFIG.whatsapp;
  const waText = encodeURIComponent('Hola, ya pagué el kit de Pídelo Bien. ¿Me envías mi código?');
  return `<div class="overlay" data-action="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pay-title">
    <div class="sheet-head"><h2 id="pay-title" tabindex="-1">Tu kit para la reunión</h2><button type="button" class="link" data-action="close-modal">Cerrar</button></div>
    <ul class="plain">
      <li>Tu cifra exacta: cuánto pedir, cuánto esperar y tu piso.</li>
      <li>Tu plan en tres tiempos: antes, durante y después de la reunión.</li>
      <li>Tu speech y tu maletín de logros, armados con tus datos.</li>
      <li>Las objeciones más comunes, con frases que responden sin ceder.</li>
      <li>Un simulador para practicar con tu jefe, incluso cuando dice que no.</li>
    </ul>
    <p class="price">${soles2(CONFIG.price)}</p>
    <p class="fine">Pago único.</p>
    ${hasPay ? `<a class="btn" href="${esc(CONFIG.payUrl)}" target="_blank" rel="noopener">Pagar ${soles2(CONFIG.price)} con Yape o tarjeta</a>` : ''}
    ${hasWa ? `<a class="btn-ghost" href="https://wa.me/${esc(CONFIG.whatsapp)}?text=${waText}" target="_blank" rel="noopener">Ya pagué: pedir mi código por WhatsApp</a>` : ''}
    ${(!hasPay && !hasWa) ? '<p class="fine">Los pagos se habilitan en el lanzamiento. Si tienes un código de acceso, ingrésalo aquí.</p>' : ''}
    <label class="small-label" for="code">Tengo un código</label>
    <div class="code-row"><input id="code" autocomplete="off" autocapitalize="characters" placeholder="PB-XXXX"><button type="button" class="btn-sm" data-action="redeem">Desbloquear</button></div>
    <p class="err" id="code-err" role="alert"></p>
    <div class="owner" data-needs="owner" hidden>
      <p class="fine">Solo tú ves esto, como dueño de la página.</p>
      <button type="button" class="btn-ghost" data-action="owner-unlock">Ver el kit sin pagar</button>
      ${(!hasPay || !hasWa) ? '<p class="fine">Antes de lanzar, configura tu link de pago y tu WhatsApp en CONFIG, al inicio del código.</p>' : ''}
    </div>
  </div></div>`;
}

function privacyHTML() {
  return `<div class="overlay" data-action="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="priv-title">
    <div class="sheet-head"><h2 id="priv-title" tabindex="-1">Cómo cuidamos tus datos</h2><button type="button" class="link" data-action="close-modal">Cerrar</button></div>
    <ul class="plain">
      <li>No pedimos tu nombre, tu DNI ni el nombre de tu empresa.</li>
      <li>En esta versión de prueba, tus respuestas se quedan en tu navegador y solo sirven para calcular tu resultado.</li>
      <li>Si usas las funciones con IA del kit, tus respuestas se envían a Claude para redactar el texto.</li>
      <li>Puedes borrar todo con "Hacer el test de nuevo".</li>
    </ul>
    <button type="button" class="btn" data-action="close-modal">Entendido</button>
  </div></div>`;
}

let lastFocus = null;
function openModal(html, focusId) {
  lastFocus = document.activeElement;
  const root = $('#modal-root');
  root.innerHTML = html;
  root.hidden = false;
  document.body.classList.add('no-scroll');
  syncCapabilityUI();
  const f = document.getElementById(focusId);
  if (f) f.focus();
}
function closeModal() {
  const root = $('#modal-root');
  root.hidden = true;
  root.innerHTML = '';
  document.body.classList.remove('no-scroll');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

// SHA-256 sin dependencias, por si el navegador no expone crypto.subtle
function sha256Fallback(ascii) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a));
  const bin = unescape(encodeURIComponent(ascii));
  const bytes = [];
  for (let i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i));
  const K = [], H = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let c = 2; primeCounter < 64; c++) {
    if (!isComposite[c]) {
      for (let i = 0; i < 313; i += c) isComposite[i] = c;
      H[primeCounter] = (Math.pow(c, 0.5) * 4294967296) | 0;
      K[primeCounter++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
    }
  }
  const hash = H.slice(0, 8);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  for (let j = 0; j < bytes.length; j += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) w[i] = (bytes[j + i * 4] << 24) | (bytes[j + i * 4 + 1] << 16) | (bytes[j + i * 4 + 2] << 8) | bytes[j + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return hash.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
async function sha256Hex(text) {
  if (window.crypto && crypto.subtle && typeof crypto.subtle.digest === 'function' && typeof TextEncoder === 'function') {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { /* usar respaldo */ }
  }
  return sha256Fallback(text);
}
async function redeem() {
  const inp = $('#code'), err = $('#code-err');
  const code = (inp.value || '').toUpperCase().replace(/\s+/g, '');
  if (!code) { err.textContent = 'Escribe tu código.'; return; }
  try {
    const h = await sha256Hex(code);
    if (CONFIG.codeHashes.includes(h)) unlock();
    else err.textContent = 'Ese código no es válido. Revisa que esté bien escrito.';
  } catch (e) {
    err.textContent = 'No se pudo validar el código en este navegador.';
  }
}
function unlock() {
  S.unlocked = true;
  closeModal();
  S.view = S.kit ? 'kit' : 'interview';
  render();
  window.scrollTo(0, 0);
}

/* ---------- Entrevista (etapa 2) ---------- */
function draft() {
  if (!S.kitDraft) S.kitDraft = Object.assign({ logro1: '', logro2: '', impacto: '', plan: '', responsabilidades: '', aprueba: 'jefe', estilo: 'cercano', trato: 'tu', oferta: 'no', jefe: '' }, S.kitIn || {});
  return S.kitDraft;
}
function chipGroup(key, options, cur) {
  return `<div class="chips" role="radiogroup">${options.map(o => `<button type="button" class="chip${cur === o.id ? ' is-on' : ''}" role="radio" aria-checked="${cur === o.id}" data-action="kchip" data-key="${key}" data-value="${o.id}">${esc(o.label)}</button>`).join('')}</div>`;
}
function viewInterview() {
  const d = draft();
  return `<section class="kit-head">
      <h1 class="h1-sm">Armemos tu kit</h1>
      <p class="lede">Con tus logros, el speech deja de ser genérico. Toma unos tres minutos.</p>
    </section>
    <div class="interview">
      <label class="field"><span>Tu logro más importante del último año, con un número</span>
        <textarea data-kf="logro1" placeholder="Ej.: reduje el cierre contable de 10 a 6 días">${esc(d.logro1)}</textarea></label>
      <label class="field"><span>Un segundo logro</span>
        <textarea data-kf="logro2" placeholder="Ej.: automaticé tres reportes que tomaban un día cada semana">${esc(d.logro2)}</textarea></label>
      <label class="field"><span>¿Qué ganó la empresa con eso?</span><small>Opcional. Ej.: dejamos de pagar unos S/ 4,000 al mes en horas extra.</small>
        <textarea data-kf="impacto">${esc(d.impacto)}</textarea></label>
      <label class="field"><span>¿Qué quieres lograr en los próximos seis meses?</span><small>Opcional. Es tu plan: lo que la empresa gana si apuesta por ti.</small>
        <textarea data-kf="plan" placeholder="Ej.: automatizar el cierre de tesorería y capacitar a los asistentes">${esc(d.plan)}</textarea></label>
      <label class="field"><span>¿Qué responsabilidades nuevas asumiste?</span><small>Opcional. Ej.: superviso a dos asistentes.</small>
        <textarea data-kf="responsabilidades">${esc(d.responsabilidades)}</textarea></label>
      <div class="field"><span>¿Quién aprueba los aumentos en tu empresa?</span>${chipGroup('aprueba', APPROVERS, d.aprueba)}</div>
      <div class="field"><span>¿Cómo es tu jefe en conversaciones difíciles?</span>${chipGroup('estilo', BOSS_STYLES, d.estilo)}</div>
      <div class="field"><span>¿Le hablas de tú o de usted?</span>${chipGroup('trato', TRATO, d.trato)}</div>
      <div class="field"><span>¿Tienes una oferta de otra empresa?</span>${chipGroup('oferta', OFFERS, d.oferta)}</div>
      <label class="field"><span>¿Cómo le dices a tu jefe?</span><small>Opcional, solo para el saludo del mensaje.</small>
        <input data-kf="jefe" autocomplete="off" placeholder="Ej.: Ana" value="${esc(d.jefe)}"></label>
      <button type="button" class="btn" data-action="build-kit">Armar mi kit</button>
      ${S.kit ? '<div class="row-actions"><button type="button" class="link" data-action="go-kit">Volver a mi kit sin cambios</button></div>' : ''}
    </div>`;
}
function buildKit() {
  const r = Engine.recommend(S.answers, new Date());
  const n = Engine.numbers(S.answers, r);
  S.kitIn = Object.assign({}, draft());
  S.kit = Kit.build(S.answers, r, n, S.kitIn, new Date());
  S.polished = false;
  S.sim = null;
  S.view = 'kit';
  render();
  window.scrollTo(0, 0);
}

/* ---------- Kit ---------- */
const SPEECH_LABELS = [['auditoria', 'Adelántate a sus dudas'], ['apertura', 'Abre con tu aporte'], ['prueba', 'Muestra la prueba'], ['plan', 'Saca tu maletín'], ['mercado', 'Pon el dato de mercado'], ['pedido', 'Pide una cifra concreta'], ['silencio', 'Calla'], ['cierre', 'Cierra con una fecha']];

function viewKit() {
  const k = S.kit;
  if (!k) { S.view = 'interview'; return viewInterview(); }
  const n = k.numbers, b = n.band;
  const out = [];
  out.push(`<section class="kit-head">
    <h1 class="h1-sm">Tu kit para la reunión</h1>
    <p class="lede">${k.cuando ? 'Úsalo ' + esc(lowerFirstUI(k.cuando)) : 'Léelo completo una vez y practica el speech en voz alta antes de pedir la reunión.'}</p>
    ${k.urgent ? `<p class="warn">${esc(k.urgent)}</p>` : ''}
    <div class="kit-tools no-print">
      <button type="button" class="btn-sm" data-action="polish" data-needs="sample" hidden>${S.polished ? 'Volver a personalizar con IA' : 'Personalizar con IA'}</button>
      <button type="button" class="btn-sm" data-action="stop-ai" id="stop-ai" hidden>Detener</button>
      <button type="button" class="btn-sm" data-action="download" data-needs="downloads" hidden>Descargar el kit</button>
      <button type="button" class="btn-sm" data-action="copy" data-copy="all">Copiar todo</button>
      <button type="button" class="btn-sm" data-action="edit-kit">Editar mis logros</button>
    </div>
    <p class="status" id="ai-status" role="status">${S.polished ? 'Kit personalizado con IA. Las cifras no cambian: las calcula el motor.' : ''}</p>
  </section>`);

  out.push(`<section class="block"><h2>Tu método en tres tiempos</h2>
    <ol class="plain">
      <li><span class="label">Antes:</span> acuerda metas con tu jefe y registra tus logros, de 8 a 12 semanas antes de pedir.</li>
      <li><span class="label">En la reunión:</span> adelántate a sus dudas, muestra tu maletín, pide una cifra precisa y calla. Ante cada objeción, etiqueta y pregunta.</li>
      <li><span class="label">Después:</span> deja todo por escrito. Si es un no, conviértelo en metas con fecha.</li>
    </ol>
  </section>`);
  const bandTable = `<table class="band-table"><thead><tr><th>Parte baja</th><th>Mediana</th><th>Parte alta</th></tr></thead><tbody><tr><td>${soles(b.p25)}</td><td>${soles(b.p50)}</td><td>${soles(b.p75)}</td></tr></tbody></table>
    <p class="fine">Banda preliminar para tu perfil, con confianza baja. En el lanzamiento se reemplaza por datos verificados.</p>`;
  if (k.raise) {
    out.push(`<section class="block"><h2>Tus números</h2>
      <div class="nums">
        <div class="num main"><span class="k">Lo que pides</span><span class="v">${soles(n.anchor)}</span></div>
        <div class="num"><span class="k">Lo que esperas</span><span class="v">${soles(n.target)}</span></div>
        <div class="num"><span class="k">Tu piso</span><span class="v">${soles(n.floor)}</span></div>
      </div>
      <p>Dices en voz alta la primera cifra. La segunda es un buen resultado. Por debajo de la tercera, en vez de aceptar, pide una fecha de revisión.</p>
      <p>Si consigues lo que esperas, son ${soles(n.annual)} más al año con gratificaciones y CTS, en régimen general.</p>
      ${k.employerCost ? `<p>Tu propuesta le costaría a la empresa cerca de ${soles(k.employerCost)} al año. Si tus resultados valen más que eso, dilo con números.</p>` : ''}
      ${k.ladder ? `<p class="label">Si te ofrecen menos</p><ol class="plain">${k.ladder.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="fine">${esc(k.ladderRule)}</p>` : ''}
      ${bandTable}
    </section>`);
  } else {
    out.push(`<section class="block"><h2>Qué pedir en vez de sueldo</h2>
      <ul class="plain">${k.alternatives.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${bandTable}
    </section>`);
  }
  if (k.prep) out.push(`<section class="block"><h2>Antes: la conversación de alto desempeño</h2>
    <p>${esc(k.prep.timing)}</p>
    <p class="label">Pide 15 minutos</p>
    <div class="say">${esc(k.prep.ask)}</div>
    <p class="label">Qué decir</p>
    <div class="say">${esc(k.prep.script)}</div>
    <div class="tools"><button type="button" class="btn-sm" data-action="copy" data-copy="prep">Copiar mensaje y guion</button></div>
    <ul class="plain"><li>${esc(k.prep.checkin)}</li><li>${esc(k.prep.log)}</li></ul>
    ${k.plan60 ? `<p class="label">Tu plan de 60 días</p><ul class="plain">${k.plan60.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  </section>`);

  out.push(`<section class="block"><h2>El mensaje para pedir la reunión</h2>
    <div class="say">${esc(k.whatsapp)}${k.whatsappFollow ? '\n\n' + esc(k.whatsappFollow) : ''}</div>
    <div class="tools"><button type="button" class="btn-sm" data-action="copy" data-copy="whatsapp">Copiar mensaje</button></div>
    <p class="fine">${esc(k.whatsappNote)}</p>
  </section>`);

  out.push(`<section class="block"><h2>Tu speech</h2>
    <ol class="speech">${SPEECH_LABELS.map(([key, label]) => `<li><span class="part">${label}</span>${esc(k.speech[key])}</li>`).join('')}</ol>
    ${k.offerNote ? `<p class="fine">${esc(k.offerNote)}</p>` : ''}
    <div class="tools"><button type="button" class="btn-sm" data-action="copy" data-copy="speech">Copiar speech</button></div>
  </section>`);

  out.push(`<section class="block"><h2>Tu maletín</h2>
    <p>Llévalo impreso a la reunión: tus resultados, lo que ganó la empresa y tu plan. Convierte el pedido en una propuesta.</p>
    <div class="say">${esc(k.sheet)}</div>
    <div class="tools"><button type="button" class="btn-sm" data-action="copy" data-copy="sheet">Copiar maletín</button></div>
  </section>`);
  if (k.tools) out.push(`<section class="block"><h2>Tus frases para la conversación</h2>
    <p>Sirven para responder sin ceder y para que tu jefe resuelva el problema contigo, no contra ti.</p>
    ${k.tools.map(t => `<div class="obj"><p class="label">${esc(t.name)}</p><p>${esc(t.how)}</p><ul class="plain">${t.ex.map(x => `<li>“${esc(x)}”</li>`).join('')}</ul></div>`).join('')}
    <p class="fine">${esc(k.voice)}</p>
  </section>`);
  out.push(`<section class="block"><h2>Lo que te van a decir y qué responder</h2>
    ${k.objections.map(o => `<div class="obj"><p class="quote">“${esc(o.q)}”</p>
      <p><span class="label">Qué significa:</span> ${esc(o.means)}</p>
      <p><span class="label">Qué responder:</span> ${esc(o.reply)}</p>
      <p><span class="label">Qué no hacer:</span> ${esc(o.avoid)}</p></div>`).join('')}
  </section>`);

  out.push(`<section class="block"><h2>Después de la reunión</h2>
    <p>Ese mismo día, deja por escrito lo que se acordó. Un "lo vemos en marzo" se vuelve compromiso cuando está en un correo.</p>
    <div class="say">${esc(k.email)}</div>
    <div class="tools"><button type="button" class="btn-sm" data-action="copy" data-copy="email">Copiar correo</button></div>
  </section>`);

  out.push(`<section class="block"><h2>Si te dicen que no</h2><ul class="plain">${k.ifNo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`);
  out.push(`<section class="block"><h2>Lo que no debes decir</h2><ul class="plain">${k.dont.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`);

  out.push(`<section class="block"><h2>Si te llama otra empresa</h2><p>${esc(k.pretension)}</p></section>`);
  out.push(`<section class="block no-print" id="sim">${simHTML()}</section>`);
  out.push(`<div class="row-actions no-print"><button type="button" class="link" data-action="back-result">Volver a mi resultado</button></div>`);
  return out.join('');
}

function copyPayload(key) {
  const k = S.kit;
  if (key === 'share') return shareText();
  if (!k) return '';
  if (key === 'whatsapp') return k.whatsapp + (k.whatsappFollow ? '\n\n' + k.whatsappFollow : '');
  if (key === 'speech') { const s = k.speech; return [s.auditoria, s.apertura, s.prueba, s.plan, s.mercado, s.pedido, s.cierre].filter(Boolean).join('\n\n'); }
  if (key === 'prep' && k.prep) return k.prep.ask + '\n\n' + k.prep.script;
  if (key === 'email') return k.email;
  if (key === 'sheet') return k.sheet;
  if (key === 'all') return Kit.toText(k, S.answers);
  return '';
}
function fallbackCopy(t) {
  const ta = document.createElement('textarea');
  ta.value = t; ta.setAttribute('readonly', '');
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}
async function copyText(t, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { ok = fallbackCopy(t); }
  if (btn) {
    const prev = btn.textContent;
    btn.textContent = ok ? 'Copiado' : 'No se pudo copiar';
    setTimeout(() => { btn.textContent = prev; }, 1600);
  }
}
function shareText() {
  const r = Engine.recommend(S.answers, new Date());
  if (r.route || !r.gap) return 'Hice el test de Pídelo Bien para saber si me toca pedir aumento. ¿Y tú?';
  return `Hice el test de Pídelo Bien: ${lowerFirstUI(gapSentence(r.gap)).replace('de tu perfil', 'de mi puesto')} ¿Y tú?`;
}
async function share(btn) {
  const text = shareText();
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  copyText(text, btn);
}
async function download() {
  if (!RT.downloads || !S.kit) return;
  try {
    await RT.downloads.save({ filename: 'kit-pidelo-bien.txt', data: Kit.toText(S.kit, S.answers) });
  } catch (e) {
    const st = $('#ai-status');
    if (e && e.code === 'declined') return;
    if (st) st.textContent = 'No se pudo descargar aquí. Usa "Copiar todo".';
    if (e && ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) { RT.downloads = null; syncCapabilityUI(); }
  }
}

/* ---------- Capacidades del visor ---------- */
function syncCapabilityUI() {
  document.querySelectorAll('[data-needs]').forEach(el => {
    const need = el.dataset.needs;
    let show = false;
    if (need === 'sample') show = !!RT.sample && !RT.busy;
    else if (need === 'downloads') show = !!RT.downloads;
    else if (need === 'owner') show = RT.isOwner;
    else if (need === 'no-sample') show = !RT.sample;
    el.hidden = !show;
  });
}
function initRuntime() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return;
  c.use('sample').then(s => { RT.sample = s || null; syncCapabilityUI(); if (S.view === 'kit' && !S.sim) refreshSim(); }).catch(() => {});
  c.use('downloads').then(d => { RT.downloads = d || null; syncCapabilityUI(); }).catch(() => {});
  c.use('user').then(u => {
    if (!u) return;
    u.isOwner().then(v => { RT.isOwner = !!v; syncCapabilityUI(); }).catch(() => {});
  }).catch(() => {});
}

/* ---------- Eventos ---------- */
function goStep(delta) {
  const steps = visibleSteps();
  const i = steps.findIndex(s => s.id === S.stepId);
  const j = i + delta;
  if (j < 0) return;
  if (j >= steps.length) { S.view = 'result'; RT.landed = false; render(); window.scrollTo(0, 0); return; }
  S.stepId = steps[j].id;
  render();
  const h = $('#q-title');
  if (h && RT.userActed) h.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function onPick(stepId, value) {
  S.answers[stepId] = value;
  if (stepId === 'contrato' && EXIT_ROUTES.includes(value)) {
    S.view = 'exit';
    render();
    window.scrollTo(0, 0);
    return;
  }
  const opts = document.querySelectorAll(`[data-step="${stepId}"]`);
  opts.forEach(o => { const on = o.dataset.value === value; o.classList.toggle('is-on', on); o.setAttribute('aria-checked', String(on)); });
  setTimeout(() => goStep(1), 160);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const act = t.dataset.action;
  if (act === 'overlay' && e.target !== t) return;
  RT.userActed = true;
  switch (act) {
    case 'home': window.scrollTo(0, 0); break;
    case 'pick': onPick(t.dataset.step, t.dataset.value); break;
    case 'back': goStep(-1); break;
    case 'salary-next': if (salaryOk()) goStep(1); break;
    case 'privacy': openModal(privacyHTML(), 'priv-title'); break;
    case 'open-paywall': openModal(paywallHTML(), 'pay-title'); break;
    case 'overlay':
    case 'close-modal': closeModal(); break;
    case 'redeem': redeem(); break;
    case 'owner-unlock': if (RT.isOwner) unlock(); break;
    case 'restart': resetTest(); break;
    case 'fix-contract': S.view = 'test'; S.stepId = 'contrato'; delete S.answers.contrato; render(); window.scrollTo(0, 0); break;
    case 'share': share(t); break;
    case 'go-kit': S.view = S.kit ? 'kit' : 'interview'; render(); window.scrollTo(0, 0); break;
    case 'back-result': S.view = 'result'; render(); window.scrollTo(0, 0); break;
    case 'edit-kit': S.kitDraft = Object.assign({}, S.kitIn || {}); S.view = 'interview'; render(); window.scrollTo(0, 0); break;
    case 'kchip': {
      const d = draft(); d[t.dataset.key] = t.dataset.value;
      t.parentElement.querySelectorAll('.chip').forEach(c => { const on = c === t; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', String(on)); });
      save();
      break;
    }
    case 'build-kit': buildKit(); break;
    case 'copy': copyText(copyPayload(t.dataset.copy), t); break;
    case 'download': download(); break;
    case 'polish': polishKit(); break;
    case 'stop-ai': if (RT.ctl) RT.ctl.abort(); break;
    case 'sim-style': simSetStyle(t.dataset.value); break;
    case 'sim-start': simStart(t.dataset.mode); break;
    case 'sim-send': simSend(); break;
    case 'sim-finish': simFinish(); break;
    case 'sim-reset': S.sim = null; refreshSim(); break;
    default: break;
  }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.field === 'sueldo' || el.dataset.field === 'variable') {
    const digits = el.value.replace(/[^\d]/g, '').slice(0, 6);
    if (digits !== el.value) el.value = digits;
    S.answers[el.dataset.field] = digits;
    const btn = document.querySelector('[data-action="salary-next"]');
    if (btn) btn.disabled = !salaryOk();
    const w = $('#sueldo-warn');
    if (w) { const msg = salaryWarning(); w.textContent = msg; w.hidden = !msg; }
    save();
  } else if (el.dataset.kf) {
    draft()[el.dataset.kf] = el.value.slice(0, 400);
    save();
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.field === 'consent') {
    S.consent = el.checked;
    const btn = document.querySelector('[data-action="salary-next"]');
    if (btn) btn.disabled = !salaryOk();
    save();
  } else if (el.dataset.field === 'campo') {
    S.answers.campo = el.checked;
    save();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal-root').hidden) closeModal();
  if (e.key === 'Enter' && e.target && e.target.id === 'code') { e.preventDefault(); redeem(); }
  if (e.key === 'Enter' && e.target && (e.target.id === 'sueldo' || e.target.id === 'variable') && salaryOk()) { e.preventDefault(); goStep(1); }
});
