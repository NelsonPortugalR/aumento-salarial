/* ============================================================
   CAPTURADOR DE AVISOS — una persona pega el texto de un aviso
   publicado; la página extrae sueldo, puesto, nivel y región, la
   persona revisa y guarda. No se guarda el texto completo.
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PORTALS = [['linkedin', 'LinkedIn'], ['computrabajo', 'Computrabajo'], ['bumeran', 'Bumeran'], ['empleosperu', 'Empleos Perú'], ['indeed', 'Indeed'], ['otro', 'Otro']];
const PERIODS = [['mensual', 'Mensual'], ['anual', 'Anual (se divide entre 14)']];
const CURRENCIES = [['PEN', 'Soles'], ['USD', 'Dólares']];
const CONTRACTS_P = [['', 'Sin dato'], ['indefinido', 'Indefinido'], ['plazo', 'Plazo fijo'], ['rxh', 'Recibos por honorarios']];
const SIZES_P = [['', 'Sin dato']].concat(SIZES.map(x => [x.id, x.label + ' personas']));
const LEVEL_TARGET = 20;   // avisos por nivel en 90 días para que el kit muestre el índice

/* ---------- Extracción (misma lógica que data/pipeline/capture_posting.py) ---------- */
const KEYWORDS = [
  [/contab|contador|tribut|impuest|costos/, 'contabilidad'],
  [/tesor|fp&a|finanz|financ|riesgo|cr[eé]dit|actuar|auditor|inversi|control de gesti|\bcfo\b|controller|presupuest/, 'finanzas'],
  [/recursos humanos|gesti[oó]n humana|talento|compensaci|business partner|hrbp|relaciones laborales|personas|selecci[oó]n|reclutad/, 'rrhh'],
  [/\bdata\b|datos|analyt|anal[ií]tic|\bbi\b|business intelligence/, 'datos'],
  [/infraestructura|network|redes|ciberseg|soporte|cloud|help ?desk|mesa de ayuda/, 'soporte'],
  [/software|desarroll|developer|programador|devops|arquitect|tech lead|product owner|full ?stack|front ?end|back ?end|\bqa\b/, 'software'],
  [/marketing|marca|brand|trade|digital|comunicaci|community/, 'marketing'],
  [/comercial|ventas|vendedor|key account|\bkam\b|negocios|sales|asesor de cuentas|ejecutivo de cuenta/, 'ventas'],
  [/atenci[oó]n al cliente|call center|teleoperador|recepcionista|cajer/, 'atencion'],
  [/mantenimiento|confiabilidad|el[eé]ctric|mec[aá]nic|electr[oó]nic/, 'mantenimiento'],
  [/seguridad|ssoma|salud ocupacional|medio ambiente|ambiental|\bhse\b|\bsst\b/, 'seguridad'],
  [/mina|minero|geolog|metalurg|perforaci|voladura|chancado/, 'ing_minas'],
  [/log[ií]st|compras|abastec|almac|supply|comex|distribuci|transporte|planificaci[oó]n de la demanda/, 'logistica'],
  [/producci|planta|calidad|operaci|excelencia|procesos|manufactura|industrial|mejora continua/, 'ing_industrial'],
  [/legal|abogad|compliance/, 'legal'],
  [/enfermer/, 'enfermeria'],
  [/m[eé]dico|farmac|tecn[oó]logo m[eé]dico|laboratorio cl[ií]nico|obstetr|nutricion/, 'salud'],
  [/docente|profesor|maestr[oa]/, 'docencia'],
  [/ingeniero civil|obra|residente|arquitecto|construcci|oficina t[eé]cnica/, 'ing_civil'],
  [/administra|asistente de gerencia|secretari/, 'administracion']
];
const REGION_WORDS = [
  ['lima', /\blima\b|callao|miraflores|san isidro|surco|la molina|san borja|\bate\b|lur[ií]n|chorrillos|san miguel|los olivos|jes[uú]s mar[ií]a|lince|magdalena|independencia/],
  ['arequipa', /arequipa/], ['libertad', /trujillo|la libertad/], ['piura', /piura|sullana|talara/],
  ['lambayeque', /chiclayo|lambayeque/], ['cusco', /cusco|cuzco/], ['ica', /\bica\b|pisco|chincha/],
  ['junin', /huancayo|jun[ií]n/], ['ancash', /chimbote|huaraz|[aá]ncash/], ['moquegua', /moquegua|\bilo\b/],
  ['tacna', /tacna/], ['cajamarca', /cajamarca/], ['puno', /puno|juliaca/], ['loreto', /iquitos|loreto/],
  ['ucayali', /pucallpa|ucayali/], ['san_martin', /tarapoto|moyobamba|san mart[ií]n/], ['pasco', /pasco/],
  ['tumbes', /tumbes/], ['ayacucho', /ayacucho|huamanga/], ['huanuco', /hu[aá]nuco/], ['apurimac', /apur[ií]mac|abancay|andahuaylas/],
  ['amazonas', /chachapoyas|amazonas/], ['madre_de_dios', /puerto maldonado|madre de dios/], ['huancavelica', /huancavelica/]
];
function levelOf(title) {
  const c = title.toLowerCase();
  if (/\b(practicante|trainee|pasante|asistente|auxiliar|t[eé]cnico)\b/.test(c)) return 'asistente';
  if (/\b(gerente|subgerente|director|head|chief|vp)\b/.test(c)) return 'gerente';
  if (/\b(jefe|superintendente)/.test(c)) return 'jefe';
  if (/\b(supervisor|coordinador|l[ií]der|lead)\b/.test(c)) return 'supervisor';
  if (/\b(senior|sr\.?|especialista|arquitecto)\b/.test(c)) return 'senior';
  if (/\b(analista|ejecutivo|ingeniero|desarrollador|developer|abogado|contador)\b/.test(c)) return 'analista';
  return '';
}
const toNum = x => parseInt(String(x).replace(/[.,](?=\d{3}\b)/g, '').replace(/[.,]\d{1,2}$/, '').replace(/[^\d]/g, ''), 10);
function parse(text) {
  const raw = text.trim();
  const low = raw.toLowerCase().replace(/\s+/g, ' ');
  const title = (raw.split('\n').find(l => l.trim()) || '').trim().slice(0, 120);
  const out = { cargo: title, puesto: '', nivel: levelOf(title), region: '', sector: '', tamano: '', min: '', max: '',
    moneda: /us\$|usd|\$us|d[oó]lares/.test(low) ? 'USD' : 'PEN',
    periodo: /anual|al a[nñ]o|por a[nñ]o|\/a[nñ]o/.test(low) ? 'anual' : 'mensual', contrato: '' };
  const NUM = '(\\d{1,3}(?:[.,]\\d{3})+|\\d{3,6})(?:[.,]\\d{2})?';
  let m = low.match(new RegExp(`(?:s\\/\\.?|us\\$|usd|\\$)\\s*${NUM}(?:\\s*(?:-|–|a|hasta)\\s*(?:s\\/\\.?|us\\$|usd|\\$)?\\s*${NUM})?`));
  if (!m) m = low.match(new RegExp(`(?:sueldo|salario|remuneraci[oó]n)[^0-9]{0,40}${NUM}(?:\\s*(?:-|–|a|hasta)\\s*${NUM})?`));
  if (m) { const a = toNum(m[1]), b = m[2] ? toNum(m[2]) : a; out.min = Math.min(a, b); out.max = Math.max(a, b); }
  const t = title.toLowerCase();
  for (const [re, role] of KEYWORDS) if (re.test(t)) { out.puesto = role; break; }
  if (!out.puesto) for (const [re, role] of KEYWORDS) if (re.test(low)) { out.puesto = role; break; }
  for (const [reg, re] of REGION_WORDS) if (re.test(low)) { out.region = reg; break; }
  if (/indeterminad|indefinid/.test(low)) out.contrato = 'indefinido';
  else if (/plazo fijo|temporal|por proyecto|suplencia/.test(low)) out.contrato = 'plazo';
  else if (/recibo por honorarios|\brxh\b|locaci[oó]n de servicios/.test(low)) out.contrato = 'rxh';
  return out;
}

/* ---------- Estado ---------- */
const ST = { tab: 'capturar', draft: null, rows: [], db: null, uid: null, canWrite: true, msg: null, filter: '' };
function urlKey(u) {   // id estable por url: evita guardar dos veces el mismo aviso
  let h = 2166136261; const s = String(u || '').trim().toLowerCase().replace(/[?#].*$/, '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'a' + (h >>> 0).toString(36);
}
const opt = (pairs, cur) => pairs.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
const pairsOf = arr => arr.map(x => [x.id, x.label]);
const mensual = r => { let v = (Number(r.min) + Number(r.max || r.min)) / 2; if (r.moneda === 'USD') v *= 3.75; if (r.periodo === 'anual') v /= 14; return v; };
const soles = n => 'S/ ' + Math.round(n).toLocaleString('en-US');

/* ---------- Vistas ---------- */
function render() {
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ST.tab)));
  const p = $('#panel');
  p.innerHTML = ST.tab === 'capturar' ? viewCapture() : ST.tab === 'avisos' ? viewList() : viewGuide();
}
function msgHTML() { return ST.msg ? `<p class="msg ${ST.msg.kind}" role="status">${esc(ST.msg.text)}</p>` : ''; }
function viewCapture() {
  const d = ST.draft;
  const form = !d ? '' : `<div class="card">
      <h2>Revisa antes de guardar</h2>
      <div class="grid">
        <label class="field">Cargo publicado<input id="f-cargo" value="${esc(d.cargo)}"></label>
        <label class="field">Puesto del test<select id="f-puesto"><option value="">Elige</option>${opt(pairsOf(ROLES), d.puesto)}</select></label>
        <label class="field">Nivel<select id="f-nivel"><option value="">Elige</option>${opt(pairsOf(LEVELS), d.nivel)}</select></label>
        <label class="field">Región<select id="f-region"><option value="">Elige</option>${opt(pairsOf(REGIONS), d.region)}</select></label>
        <label class="field">Sueldo mínimo<input id="f-min" inputmode="numeric" value="${esc(d.min)}"></label>
        <label class="field">Sueldo máximo<input id="f-max" inputmode="numeric" value="${esc(d.max)}"></label>
        <label class="field">Moneda<select id="f-moneda">${opt(CURRENCIES, d.moneda)}</select></label>
        <label class="field">Periodo<select id="f-periodo">${opt(PERIODS, d.periodo)}</select></label>
        <label class="field">Sector<select id="f-sector"><option value="">Sin dato</option>${opt(pairsOf(SECTORS), d.sector)}</select></label>
        <label class="field">Tamaño de empresa<select id="f-tamano">${opt(SIZES_P, d.tamano)}</select></label>
        <label class="field">Contrato<select id="f-contrato">${opt(CONTRACTS_P, d.contrato)}</select></label>
      </div>
      <div class="row"><button type="button" class="btn" data-act="save">Guardar aviso</button><button type="button" class="btn-ghost" data-act="discard">Descartar</button></div>
      <p class="note">Solo se guardan estos campos y el enlace. El texto del aviso no se guarda.</p>
    </div>`;
  return `<div class="grid">
      <label class="field">Portal<select id="c-portal">${opt(PORTALS, ST.portal || 'linkedin')}</select></label>
      <label class="field">Enlace del aviso<input id="c-url" type="url" placeholder="https://…" value="${esc(ST.url || '')}"></label>
    </div>
    <label class="field">Texto del aviso<textarea id="c-text" placeholder="Copia el aviso desde el portal y pégalo aquí: el título primero, luego la descripción con el sueldo.">${esc(ST.text || '')}</textarea></label>
    <div class="row"><button type="button" class="btn" data-act="parse">Leer aviso</button><span class="note">Sirve solo si el aviso publica el sueldo.</span></div>
    ${msgHTML()}
    ${form}`;
}
function stats() {
  const since = Date.now() - 90 * 864e5;
  const recent = ST.rows.filter(r => Date.parse(r.creado) >= since);
  const byLevel = LEVELS.map(l => [l, recent.filter(r => r.nivel === l.id).length]);
  return { total: ST.rows.length, recent: recent.length, byLevel };
}
function viewList() {
  const s = stats();
  const q = ST.filter.toLowerCase();
  const rows = ST.rows.filter(r => !q || [r.cargo, r.portal, r.puesto, r.region, r.nivel].join(' ').toLowerCase().includes(q))
    .sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
  const lvl = id => (LEVELS.find(x => x.id === id) || {}).label || 'Sin nivel';
  const role = id => (ROLES.find(x => x.id === id) || {}).label || 'Sin puesto';
  const reg = id => (REGIONS.find(x => x.id === id) || {}).label || 'Sin región';
  return `<div class="stats">
      <div class="card stat"><span class="note">Avisos guardados</span><b>${s.total}</b></div>
      <div class="card stat"><span class="note">Últimos 90 días</span><b>${s.recent}</b></div>
    </div>
    <div class="card"><h2>Meta por nivel</h2><p class="note">Con ${LEVEL_TARGET} avisos de un nivel en 90 días, el kit muestra cuánto se está ofreciendo para ese nivel.</p>
      ${s.byLevel.map(([l, n]) => `<div class="stat"><div class="row" style="justify-content:space-between"><span>${esc(l.label)}</span><span class="note">${n} de ${LEVEL_TARGET}</span></div><div class="bar"><span style="width:${Math.min(100, n / LEVEL_TARGET * 100)}%"></span></div></div>`).join('')}
    </div>
    <div class="row"><button type="button" class="btn-ghost" data-act="csv">Copiar CSV para el modelo</button><span class="note" id="csv-msg"></span></div>
    <textarea id="csv-box" hidden readonly></textarea>
    <label class="field">Buscar<input id="filter" placeholder="Cargo, portal, región…" value="${esc(ST.filter)}"></label>
    <div class="list">${rows.map(r => `<div class="item">
        <span class="t">${esc(r.cargo)}</span>
        <span class="m">${esc(role(r.puesto))} · ${esc(lvl(r.nivel))} · ${esc(reg(r.region))}</span>
        <div class="row"><span class="m">${r.moneda === 'USD' ? 'US$' : 'S/'} ${Number(r.min).toLocaleString('en-US')}${r.max && r.max !== r.min ? ' a ' + Number(r.max).toLocaleString('en-US') : ''} ${r.periodo} · ≈ ${soles(mensual(r))} al mes · ${esc(r.portal)} · ${esc(String(r.creado).slice(0, 10))}</span>
        ${r.por === ST.uid || ST.isOwner ? `<button type="button" class="link" data-act="del" data-id="${esc(r.id)}">Borrar</button>` : ''}</div>
      </div>`).join('') || '<p class="note">Todavía no hay avisos. Captura el primero en la pestaña Capturar.</p>'}</div>`;
}
function viewGuide() {
  return `<div class="guide">
    <h2>Cómo capturar sin problemas legales</h2>
    <ol>
      <li>Abre el portal como cualquier usuario y busca avisos de tu interés que publiquen el sueldo.</li>
      <li>Copia el texto del aviso y pégalo aquí con su enlace. Una persona lee y copia: nada se extrae en automático, porque Computrabajo y Bumeran lo prohíben en sus condiciones y LinkedIn también.</li>
      <li>Revisa lo que la página detectó, corrige si hace falta y guarda. Se guardan solo cifras, puesto, nivel, región y el enlace; nunca el texto completo ni datos de personas (nombres de reclutadores, correos o teléfonos).</li>
      <li>Usa los datos como referencia agregada: el producto nunca muestra avisos uno por uno ni cita al portal como fuente de una cifra individual.</li>
    </ol>
    <h2>Cuánto y cuándo</h2>
    <ul>
      <li>De 50 a 100 avisos al mes, repartidos entre niveles y regiones. Media hora a la semana alcanza.</li>
      <li>Prioriza los niveles que están lejos de su meta en la pestaña Avisos.</li>
      <li>Una vez al mes, toca "Copiar CSV para el modelo" y guárdalo en <code>data/benchmarks/avisos/avisos_AAAA-MM.csv</code>, o pídele a Claude que lea esta base y actualice el modelo.</li>
    </ul>
    <h2>Para qué sirven</h2>
    <ul>
      <li>Pretensión salarial: cuánto pedir si te llama otra empresa, con lo que se está ofreciendo hoy.</li>
      <li>Alerta temprana: si lo ofrecido sube o baja más de 10% dos meses seguidos, toca revisar las bandas.</li>
      <li>Puestos que faltan: cargos que aparecen seguido y no tienen buen dato en la encuesta del INEI.</li>
      <li>Contenido: un índice mensual de lo ofrecido por nivel para LinkedIn y prensa, citado como agregado propio.</li>
    </ul>
  </div>`;
}

/* ---------- Acciones ---------- */
function readForm() {
  const v = id => ($('#' + id) || {}).value || '';
  return { cargo: v('f-cargo').trim().slice(0, 120), puesto: v('f-puesto'), nivel: v('f-nivel'), region: v('f-region'),
    min: parseInt(v('f-min').replace(/[^\d]/g, ''), 10) || '', max: parseInt(v('f-max').replace(/[^\d]/g, ''), 10) || '',
    moneda: v('f-moneda'), periodo: v('f-periodo'), sector: v('f-sector'), tamano: v('f-tamano'), contrato: v('f-contrato') };
}
async function save() {
  const f = readForm();
  if (!f.min) { ST.msg = { kind: 'warn', text: 'Falta el sueldo. Si el aviso no lo publica, descártalo.' }; return render(); }
  if (!f.puesto || !f.nivel || !f.region) { ST.msg = { kind: 'warn', text: 'Elige puesto, nivel y región antes de guardar.' }; return render(); }
  if (!f.max) f.max = f.min;
  const m = mensual(f);
  if (m < 1000 || m > 150000) { ST.msg = { kind: 'warn', text: `El sueldo mensual queda en ${soles(m)}. Revisa la moneda y el periodo.` }; return render(); }
  const rec = Object.assign(f, { portal: ST.portal || 'linkedin', url: (ST.url || '').trim(), creado: new Date().toISOString(), por: ST.uid || null });
  const id = rec.url ? urlKey(rec.url) : undefined;
  if (id && ST.rows.some(r => r.id === id)) { ST.msg = { kind: 'warn', text: 'Ese aviso ya está guardado.' }; return render(); }
  if (!ST.db) { ST.msg = { kind: 'warn', text: 'La base de datos no está disponible en esta vista. Abre la página desde claude.ai con tu cuenta.' }; return render(); }
  try {
    await ST.db.collection('avisos').doc(id).set(rec);
    ST.draft = null; ST.text = ''; ST.url = '';
    ST.msg = { kind: 'ok', text: `Guardado: ${rec.cargo || 'aviso'} (${soles(m)} al mes).` };
  } catch (e) {
    ST.msg = { kind: 'warn', text: e && e.code === 'quota_exceeded' ? 'La base llegó a su límite. Exporta el CSV y borra avisos antiguos.' : 'No se pudo guardar. Revisa que tengas permiso para editar esta página e intenta de nuevo.' };
  }
  render();
}
function csv() {
  const head = ['fecha', 'portal', 'url', 'cargo_publicado', 'puesto', 'nivel', 'region', 'sector', 'tamano', 'sueldo_min', 'sueldo_max', 'moneda', 'periodo', 'contrato', 'notas'];
  const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [head.join(',')].concat(ST.rows.map(r => [String(r.creado).slice(0, 10), r.portal, r.url, r.cargo, r.puesto, r.nivel, r.region, r.sector, r.tamano, r.min, r.max, r.moneda, r.periodo, r.contrato, ''].map(q).join(','))).join('\n');
}

document.addEventListener('click', async e => {
  const tab = e.target.closest('.tab');
  if (tab) { ST.tab = tab.dataset.tab; ST.msg = null; return render(); }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'parse') {
    ST.portal = $('#c-portal').value; ST.url = $('#c-url').value; ST.text = $('#c-text').value;
    if (!ST.text.trim()) { ST.msg = { kind: 'warn', text: 'Pega primero el texto del aviso.' }; return render(); }
    ST.draft = parse(ST.text);
    ST.msg = ST.draft.min ? null : { kind: 'warn', text: 'No encontré un sueldo en el texto. Escríbelo abajo si está en el aviso; si no lo publica, descártalo.' };
    render();
  } else if (act === 'discard') { ST.draft = null; ST.text = ''; ST.msg = null; render(); }
  else if (act === 'save') { b.disabled = true; await save(); }
  else if (act === 'del') {
    if (!ST.db) return;
    try { await ST.db.collection('avisos').doc(b.dataset.id).delete(); } catch (err) { /* sin permiso: no pasa nada */ }
  } else if (act === 'csv') {
    const text = csv(); const out = $('#csv-msg');
    try { await navigator.clipboard.writeText(text); out.textContent = `Copiado: ${ST.rows.length} avisos.`; }
    catch (err) { const box = $('#csv-box'); box.hidden = false; box.value = text; box.select(); out.textContent = 'Selecciona el texto de abajo y cópialo.'; }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'filter') { ST.filter = e.target.value; const pos = e.target.selectionStart; render(); const f = $('#filter'); f.focus(); f.setSelectionRange(pos, pos); }
  if (e.target.id === 'c-text') ST.text = e.target.value;
  if (e.target.id === 'c-url') ST.url = e.target.value;
});
document.addEventListener('change', e => { if (e.target.id === 'c-portal') ST.portal = e.target.value; });

/* ---------- Arranque ---------- */
render();
(async () => {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return;
  const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
  if (user) {
    ST.uid = await user.id().catch(() => null);
    ST.isOwner = await user.isOwner().catch(() => false);
  }
  if (!db) return;
  ST.db = db;
  db.collection('avisos').onSnapshot(snap => {
    ST.rows = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    if (ST.tab === 'avisos') render();
  }, () => { ST.db = null; });
})();
