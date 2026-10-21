'use strict';
// Panel interno: lee /api/resumen con el token guardado en este navegador y dibuja el embudo.
(() => {
  const KEY = 'pidelo-bien-panel';
  const $ = id => document.getElementById(id);
  const tip = $('p-tip');
  let token = '';
  try { token = localStorage.getItem(KEY) || ''; } catch (e) { /* sin almacenamiento */ }
  let dias = 30;

  const EMBUDO = { visitas: 'Visitas', iniciaron: 'Empezaron el test', completaron: 'Completaron el test', vieron_el_muro: 'Vieron el precio', clic_en_pagar: 'Tocaron pagar o WhatsApp', desbloquearon: 'Desbloquearon el kit', armaron_el_kit: 'Armaron su kit', practicaron: 'Practicaron con el simulador' };
  const PASOS = { puesto: 'Puesto', nivel: 'Nivel', sector: 'Sector', region: 'Región', tamano: 'Tamaño de empresa', contrato: 'Contrato', vence: 'Vencimiento (solo plazo fijo)', experiencia: 'Experiencia', antiguedad: 'Tiempo en el puesto', sueldo: 'Sueldo', aumento: 'Último aumento', funciones: 'Funciones nuevas', logros: 'Logros medibles', empresa: 'Situación de la empresa' };
  const CODIGOS = { pide_ahora: 'Pide ahora', pide_pronto: 'Pide en unas semanas', construye: 'Pide en 8 semanas', merito: 'Pide por mérito', trato: 'Pide un trato', paquete: 'Pide más que sueldo', metas: 'Pide metas primero', esperar: 'Pide en un mes concreto', mercado: 'Negocia con el mercado' };
  const ZONAS = { bajo: 'Bajo el rango', rango: 'En rango', alto: 'Sobre el rango' };
  const SALIDAS = { publico: 'Sector público', civil: 'Construcción civil', rxh: 'Recibos por honorarios' };
  const EQUIPOS = { m: 'Celular', d: 'Computadora' };
  const FUENTES = { directo: 'Directo o sin dato', compartido: 'Resultado compartido' };
  const ACCIONES = { share: 'Compartieron su resultado', contribute: 'Aportaron su sueldo', copy_all: 'Copiaron todo el kit', copy_speech: 'Copiaron el speech', copy_whatsapp: 'Copiaron el mensaje para pedir la reunión', copy_prep: 'Copiaron la preparación', copy_sheet: 'Copiaron el maletín', copy_email: 'Copiaron el correo de cierre', download: 'Descargaron el kit', polish: 'Personalizaron con IA', method_view: 'Abrieron "Cómo lo calculamos"', privacy_view: 'Abrieron "Cómo cuidamos tus datos"', restart: 'Rehicieron el test', code_bad: 'Ingresaron un código inválido' };
  const label = (map, v) => map[v] || (v === 'sin_dato' ? 'Sin dato' : v);
  const precio = v => /^p\d+$/.test(v) ? 'S/ ' + (Number(v.slice(1)) / 100).toFixed(2) : label({}, v);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
  const pctR = r => r == null ? '—' : Math.round(r * 100) + '%';
  const fecha = (d, opts) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-PE', Object.assign({ timeZone: 'UTC' }, opts));
  const diaCorto = d => fecha(d, { day: 'numeric', month: 'short' });
  const diaLargo = d => fecha(d, { day: 'numeric', month: 'long', year: 'numeric' });
  const compact = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'K' : String(v);
  const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))); const m = v / p; return Math.max(2, (m <= 2 ? 2 : m <= 4 ? 4 : m <= 6 ? 6 : m <= 8 ? 8 : 10) * p); };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false && c !== '') el.append(c instanceof Node ? c : String(c));
    return el;
  }

  /* ---------- Tooltip ---------- */
  function showTip(x, y, rows, title) {
    tip.textContent = '';
    if (title) tip.append(h('div', { class: 'note' }, title));
    for (const r of rows) tip.append(h('div', { class: 'row' }, h('span', {}, r.key ? h('i', { class: r.key }) : null, r.label), h('b', {}, r.value)));
    tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, x + 14)) + 'px';
    tip.style.top = Math.max(8, y - tip.offsetHeight - 10) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------- Piezas ---------- */
  const kpi = (k, v, d) => h('div', { class: 'kpi' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), d ? h('div', { class: 'd' }, d) : null);
  const card = (title, sub, ...content) => h('section', { class: 'card' }, h('h2', {}, title), sub ? h('p', { class: 'sub' }, sub) : null, ...content);

  function bars(items) {
    const max = Math.max(1, ...items.map(i => i.n));
    return h('ul', { class: 'bars' }, items.map(it => {
      const fill = h('span', { class: 'fill' });
      fill.style.setProperty('--w', it.n ? String(Math.max(it.n / max, 0.01)) : '0');
      const li = h('li', { tabindex: '0' }, h('span', { class: 'lab' }, it.label), h('span', { class: 'barra' }, fill, h('span', { class: 'val' }, fmt(it.n) + (it.note ? ' · ' + it.note : ''))));
      const show = (x, y) => showTip(x, y, [{ label: 'Sesiones', value: fmt(it.n) }, ...(it.extra || [])], it.label);
      li.addEventListener('pointermove', e => show(e.clientX, e.clientY));
      li.addEventListener('pointerleave', hideTip);
      li.addEventListener('focus', () => { const r = li.getBoundingClientRect(); show(r.left + 60, r.top + 4); });
      li.addEventListener('blur', hideTip);
      return li;
    }));
  }

  function table(cols, rows, empty) {
    if (!rows.length) return h('p', { class: 'empty' }, empty || 'Sin datos en este periodo.');
    return h('div', { class: 'tabla-wrap' }, h('table', { class: 'tabla' },
      h('thead', {}, h('tr', {}, cols.map(c => h('th', { class: c.n ? 'n' : null, scope: 'col' }, c.t)))),
      h('tbody', {}, rows.map(r => h('tr', {}, cols.map(c => h('td', { class: c.n ? 'n' : null }, c.f(r))))))));
  }

  // Visitas y tests completos por día: una escala, dos líneas, cruz que sigue al puntero y tabla equivalente
  function lineChart(rows) {
    const W = 640, H = 230, L = 40, R = 18, T = 14, B = 28;
    const SERIES = [{ key: 'visitas', name: 'Visitas', n: 1 }, { key: 'completaron', name: 'Tests completos', n: 2 }];
    const max = niceMax(Math.max(...rows.map(r => r.visitas), 1));
    const x = i => L + (rows.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (rows.length - 1));
    const y = v => T + (H - T - B) * (1 - v / max);
    const NS = 'http://www.w3.org/2000/svg';
    const s = (tag, attrs, text) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); if (text != null) el.textContent = text; return el; };
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-label': 'Visitas y tests completos por día. Usa las flechas para recorrer los días.' });
    const grid = s('g', { class: 'grid' }), axis = s('g', { class: 'axis' });
    for (const v of [0, max / 2, max]) {
      grid.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      axis.append(s('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, compact(v)));
    }
    for (const i of [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])]) {
      axis.append(s('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle' }, diaCorto(rows[i].dia)));
    }
    svg.append(grid, axis);
    const last = rows.length - 1;
    for (const se of SERIES) svg.append(s('polyline', { class: 'l' + se.n, points: rows.map((r, i) => `${x(i)},${y(r[se.key])}`).join(' ') }));
    const cross = s('line', { class: 'cross', y1: T, y2: H - B, x1: 0, x2: 0, visibility: 'hidden' });
    svg.append(cross);
    for (const se of SERIES) svg.append(s('circle', { class: 'p' + se.n + ' ring', cx: x(last), cy: y(rows[last][se.key]), r: 4 }));
    // Etiquetas directas al final, solo si no chocan
    const ends = SERIES.map(se => y(rows[last][se.key]));
    if (Math.abs(ends[0] - ends[1]) >= 14) SERIES.forEach((se, i) => svg.append(s('text', { class: 'end', x: x(last) - 8, y: ends[i] - 8, 'text-anchor': 'end' }, fmt(rows[last][se.key]))));

    const show = (i, cx, cy) => {
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      showTip(cx, cy, SERIES.map(se => ({ key: 'k' + se.n, label: se.name, value: fmt(rows[i][se.key]) })), diaLargo(rows[i].dia));
    };
    const nearest = clientX => {
      const r = svg.getBoundingClientRect();
      const px = (clientX - r.left) * W / r.width;
      let best = 0;
      rows.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
      return best;
    };
    let cur = last;
    svg.addEventListener('pointermove', e => { cur = nearest(e.clientX); show(cur, e.clientX, e.clientY); });
    svg.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
    svg.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') cur = Math.max(0, cur - 1);
      else if (e.key === 'ArrowRight') cur = Math.min(last, cur + 1);
      else return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      show(cur, r.left + x(cur) * r.width / W, r.top + 24);
    });
    svg.addEventListener('blur', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });

    const legend = h('div', { class: 'legend' }, SERIES.map(se => h('span', {}, h('i', { class: 'k' + se.n }), se.name)));
    const tv = h('details', { class: 'table-view' }, h('summary', {}, 'Ver como tabla'),
      table([{ t: 'Día', f: r => diaLargo(r.dia) }, { t: 'Visitas', n: 1, f: r => fmt(r.visitas) }, { t: 'Tests completos', n: 1, f: r => fmt(r.completaron) }], rows.slice().reverse()));
    return [legend, h('div', { class: 'chart' }, svg), tv];
  }

  /* ---------- Resumen ---------- */
  function render(d) {
    const body = $('p-body');
    body.textContent = '';
    $('p-range').textContent = `Del ${diaLargo(d.desde)} al ${diaLargo(d.hasta)} · ${fmt(d.eventos)} eventos`;
    const e = d.embudo, t = d.tasas;
    body.append(h('div', { class: 'kpis' },
      kpi('Visitas', fmt(e.visitas), `${fmt(e.iniciaron)} empezaron el test`),
      kpi('Tests completos', fmt(e.completaron), `${pctR(t.inicio_a_completo)} de quienes empezaron`),
      kpi('Vieron el precio', fmt(e.vieron_el_muro), `${pctR(t.completo_a_muro)} de los tests completos`),
      kpi('Tocaron pagar', fmt(e.clic_en_pagar), `${pctR(t.muro_a_clic)} de quienes vieron el precio`),
      kpi('Desbloquearon el kit', fmt(e.desbloquearon), `${pctR(t.completo_a_desbloqueo)} de los tests completos`),
      kpi('Aportes de sueldo', fmt(d.aportes.total), 'desde el inicio')));
    if (!e.visitas) body.append(h('p', { class: 'empty' }, 'Todavía no hay visitas en este periodo. Abre el test en otra pestaña y vuelve a actualizar.'));

    const keys = Object.keys(EMBUDO);
    const funnel = keys.map((k, i) => ({
      label: EMBUDO[k], n: e[k], note: i ? pct(e[k], e[keys[i - 1]]) : '',
      extra: i ? [{ label: 'Del paso anterior', value: pct(e[k], e[keys[i - 1]]) }, { label: 'De las visitas', value: pct(e[k], e.visitas) }] : []
    }));
    const steps = d.pasos.map(p => ({ label: PASOS[p.paso] || p.paso, n: p.sesiones, note: pct(p.sesiones, e.iniciaron), extra: [{ label: 'De quienes empezaron', value: pct(p.sesiones, e.iniciaron) }] }));
    body.append(h('div', { class: 'cards two' },
      card('Embudo', 'Sesiones que llegaron a cada punto. El porcentaje es frente al paso anterior.', bars(funnel)),
      card('Abandono por pregunta', 'Sesiones que vieron cada pregunta. El porcentaje es frente a quienes empezaron.', bars(steps))));
    body.append(h('div', { class: 'cards' }, card('Por día', 'Sesiones nuevas de cada día y cuántas completaron el test.', ...lineChart(d.diario))));

    const f = {
      visitas: { t: 'Visitas', n: 1, f: r => fmt(r.visitas) },
      completaron: { t: 'Completaron', n: 1, f: r => fmt(r.completaron) },
      muro: { t: 'Vieron el precio', n: 1, f: r => fmt(r.vieron_el_muro) },
      clic: { t: 'Tocaron pagar', n: 1, f: r => fmt(r.clic_en_pagar) },
      desbloqueo: { t: 'Desbloquearon', n: 1, f: r => fmt(r.desbloquearon) },
      tasa: { t: 'Precio a pagar', n: 1, f: r => pct(r.clic_en_pagar, r.vieron_el_muro) }
    };
    const n = { t: 'Sesiones', n: 1, f: r => fmt(r.n) };
    body.append(h('div', { class: 'cards' },
      card('Prueba de precio', d.precios.length > 1 ? 'Cada navegador ve siempre el mismo precio.' : 'Hay un solo precio activo. La prueba empieza cuando cada precio tiene su link de pago.',
        table([{ t: 'Precio', f: r => precio(r.valor) }, f.visitas, f.completaron, f.muro, f.clic, f.desbloqueo, f.tasa], d.precios))));
    body.append(h('div', { class: 'cards two' },
      card('De dónde llegan', 'Según el parámetro utm_source o ref del enlace, o el sitio de origen.',
        table([{ t: 'Origen', f: r => label(FUENTES, r.valor) }, f.visitas, f.completaron, f.clic], d.fuentes)),
      card('Celular o computadora', null, table([{ t: 'Equipo', f: r => label(EQUIPOS, r.valor) }, f.visitas, f.completaron, f.clic], d.equipos))));
    body.append(h('div', { class: 'cards two' },
      card('Resultados del test', 'Recomendación que recibió cada test completo.',
        table([{ t: 'Recomendación', f: r => label(CODIGOS, r.valor) }, { t: 'Tests', n: 1, f: r => fmt(r.n) }, { t: 'Del total', n: 1, f: r => pct(r.n, e.completaron) }], d.resultados)),
      card('Posición frente al mercado', 'Dónde quedó el sueldo frente a la banda de su perfil.',
        table([{ t: 'Posición', f: r => label(ZONAS, r.valor) }, { t: 'Tests', n: 1, f: r => fmt(r.n) }, { t: 'Del total', n: 1, f: r => pct(r.n, e.completaron) }], d.zonas))));
    const meses = Object.entries(d.aportes.por_mes).sort().reverse().map(([valor, c]) => ({ valor, n: c }));
    body.append(h('div', { class: 'cards two' },
      card('Salidas honestas', 'Personas a las que el test no aplica: sector público, construcción civil o recibos por honorarios.',
        table([{ t: 'Salida', f: r => label(SALIDAS, r.valor) }, n], d.salidas)),
      card('Otras acciones', 'Sesiones que hicieron cada acción.',
        table([{ t: 'Acción', f: r => label(ACCIONES, r.valor) }, n], Object.entries(d.acciones).map(([valor, c]) => ({ valor, n: c })).sort((a, b) => b.n - a.n)))));
    body.append(h('div', { class: 'cards' },
      card('Aportes y reclamos', null,
        h('p', {}, `${fmt(d.aportes.total)} ${d.aportes.total === 1 ? 'aporte' : 'aportes'} de sueldo con consentimiento.`),
        table([{ t: 'Mes', f: r => r.valor }, { t: 'Aportes', n: 1, f: r => fmt(r.n) }], meses, 'Todavía no hay aportes.'),
        h('p', { class: 'note' }, `${fmt(d.reclamos.total)} ${d.reclamos.total === 1 ? 'hoja' : 'hojas'} de reclamación en ${d.reclamos.anio}. El detalle llega a Netlify, en Forms; respóndelas en un plazo máximo de 15 días hábiles.`))));
  }

  async function load() {
    const body = $('p-body');
    body.classList.add('loading');
    $('p-main-err').textContent = '';
    try {
      const r = await fetch(`/api/resumen?dias=${dias}`, { headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401) { logout('Ese token no es válido.'); return; }
      if (!r.ok) throw new Error(String(r.status));
      render(await r.json());
    } catch (e) {
      $('p-main-err').textContent = 'No se pudo cargar el resumen. Intenta de nuevo en un momento.';
    } finally {
      body.classList.remove('loading');
    }
  }

  function showLogin(msg) {
    $('p-main').hidden = true;
    $('p-login').hidden = false;
    $('p-err').textContent = msg || '';
    $('p-token').focus();
  }
  function logout(msg) {
    token = '';
    try { localStorage.removeItem(KEY); } catch (e) { /* ignorar */ }
    showLogin(msg);
  }
  function start() {
    $('p-login').hidden = true;
    $('p-main').hidden = false;
    load();
  }

  $('p-token-form').addEventListener('submit', e => {
    e.preventDefault();
    token = $('p-token').value.trim();
    if (!token) return;
    try { localStorage.setItem(KEY, token); } catch (x) { /* ignorar */ }
    start();
  });
  $('p-dias').addEventListener('click', e => {
    const b = e.target.closest('[data-dias]');
    if (!b) return;
    dias = Number(b.dataset.dias);
    for (const x of $('p-dias').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    load();
  });
  $('p-refresh').addEventListener('click', load);
  $('p-logout').addEventListener('click', () => logout(''));
  for (const b of document.querySelectorAll('[data-export]')) b.addEventListener('click', async () => {
    const prev = b.textContent;
    b.disabled = true;
    b.textContent = 'Preparando…';
    try {
      const r = await fetch(`/api/exportar?tipo=${b.dataset.export}&dias=${dias}`, { headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401) { logout('Ese token no es válido.'); return; }
      if (!r.ok) throw new Error(String(r.status));
      const name = ((r.headers.get('content-disposition') || '').match(/filename="([^"]+)"/) || [])[1] || b.dataset.export + '.txt';
      const url = URL.createObjectURL(await r.blob());
      const a = h('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      $('p-main-err').textContent = 'No se pudo descargar. Intenta de nuevo.';
    } finally {
      b.disabled = false;
      b.textContent = prev;
    }
  });

  if (token) start(); else showLogin();
})();
