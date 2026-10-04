const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('./pidelo-bien.html', 'utf8');
const errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));

async function run(name, steps, opts = {}) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' ,
    beforeParse(w) {
      w.addEventListener('error', e => errors.push(name + ': ' + (e.error && e.error.stack || e.message)));
      w.scrollTo = () => {};
      if (opts.claude) w.claude = opts.claude(w);
    }});
  const w = dom.window, d = w.document;
  const click = sel => { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error(name + ': no element ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const pick = async (step, value) => { click(`[data-step="${step}"][data-value="${value}"]`); await wait(220); };
  const type = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const check = sel => { const el = d.querySelector(sel); el.checked = true; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  await wait(50);
  await steps({ w, d, click, pick, type, check, wait });
  return dom;
}

(async () => {
  // 1) Flujo completo: contadora, resultado, paywall, código, entrevista, kit, simulador guiado
  await run('flow1', async ({ w, d, click, pick, type, check, wait }) => {
    if (!d.querySelector('h1').textContent.includes('¿Te sumaron funciones')) throw new Error('hero missing');
    await pick('puesto', 'contabilidad');
    await pick('nivel', 'analista');
    await pick('sector', 'industria');
    await pick('region', 'arequipa');
    if (!d.body.textContent.includes('Lima Metropolitana y Callao') && !d.querySelector('[data-step="tamano"]')) throw new Error('region step broken');
    await pick('tamano', 's3');
    await pick('contrato', 'plazo');
    await pick('vence', 'v3');
    await pick('experiencia', 'e3');
    await pick('antiguedad', 't3');
    // salary: calculadora de bruto desde neto
    click('[data-action="net-open"]'); await wait(20);
    type('#neto', '2000');
    const netOut = d.getElementById('net-out').textContent;
    if (!/S\/\s2,25\d/.test(netOut)) throw new Error('net calc unexpected: ' + netOut);
    console.log('net calc:', netOut);
    click('[data-action="use-gross"]'); await wait(20);
    if (!d.querySelector('#sueldo').value) throw new Error('use-gross did not fill salary');
    console.log('gross from net 2000:', d.querySelector('#sueldo').value);
    // salary
    const btn = () => d.querySelector('[data-action="salary-next"]');
    type('#sueldo', 'S/ 2,300x'); // sanitize -> 2300
    if (d.querySelector('#sueldo').value !== '2300') throw new Error('sanitize failed: ' + d.querySelector('#sueldo').value);
    if (d.querySelector('[data-field="consent"]')) throw new Error('consent checkbox should be gone');
    if (btn().disabled) throw new Error('should be enabled');
    click('[data-action="salary-next"]'); await wait(50);
    await pick('aumento', 'a99');
    await pick('funciones', 'personas');
    await pick('logros', 'varios');
    await pick('empresa', 'estable');
    await wait(50);
    const stamp = d.querySelector('.stamp');
    if (!stamp) throw new Error('no stamp');
    console.log('RESULT stamp:', stamp.textContent, '| verdict:', d.querySelector('.verdict').textContent);
    console.log('gap:', d.querySelectorAll('.slip p')[1].textContent);
    console.log('moment:', [...d.querySelectorAll('.slip p')].find(p => /^(Buen momento|Momento)/.test(p.textContent)).textContent);
    console.log('preview items:', d.querySelectorAll('.preview li').length);
    console.log('confidence:', [...d.querySelectorAll('.slip .fine')].map(p => p.textContent).find(t => /Confianza/.test(t)));
    click('[data-action="method"]'); await wait(20);
    if (!d.getElementById('method-title')) throw new Error('method modal missing');
    click('[data-action="close-modal"]'); await wait(20);
    // paywall
    click('[data-action="open-paywall"]'); await wait(20);
    if (d.getElementById('modal-root').hidden) throw new Error('modal not open');
    type('#code', 'pb-xxxx'); click('[data-action="redeem"]'); await wait(80);
    console.log('bad code msg:', d.getElementById('code-err').textContent);
    d.getElementById('code').value = 'pb-k7m2'; click('[data-action="redeem"]'); await wait(120);
    if (!d.querySelector('[data-kf="logro1"]')) throw new Error('interview not shown; view=' + d.querySelector('h1') && d.querySelector('h1').textContent);
    type('[data-kf="logro1"]', 'Reduje el cierre contable de 10 a 6 días');
    type('[data-kf="logro2"]', 'Automaticé tres reportes semanales.');
    type('[data-kf="responsabilidades"]', 'superviso a dos asistentes');
    click('[data-action="kchip"][data-key="aprueba"][data-value="gerencia"]');
    click('[data-action="kchip"][data-key="trato"][data-value="usted"]');
    type('[data-kf="jefe"]', 'Sra. Ana');
    click('[data-action="build-kit"]'); await wait(50);
    const h2s = [...d.querySelectorAll('#app h2')].map(h => h.textContent);
    console.log('KIT sections:', h2s.join(' | '));
    console.log('WA:', d.querySelector('.say').textContent);
    console.log('pedido:', [...d.querySelectorAll('.speech li')][4].textContent); console.log('prep:', d.body.textContent.includes('Antes: la conversación de alto desempeño'), '| maletin:', d.body.textContent.includes('Tu maletín'));
    console.log('objeciones:', d.querySelectorAll('.obj').length);
    // simulator guided
    click('[data-action="sim-start"][data-mode="guiada"]'); await wait(20);
    type('#sim-input', 'Gracias por el tiempo. Este año reduje el cierre de 10 a 6 días y superviso a dos asistentes. Quiero proponer un ajuste a S/ 2,650.');
    d.querySelector('#sim-input').value = 'Gracias por el tiempo. Este año reduje el cierre de 10 a 6 días y superviso a dos asistentes. Quiero proponer un ajuste a S/ 2,650.';
    click('[data-action="sim-send"]'); await wait(20);
    for (let i = 0; i < 4; i++) { d.querySelector('#sim-input').value = 'Entiendo. ¿Podemos dejarlo para el próximo presupuesto y revisarlo en enero o en febrero?'; click('[data-action="sim-send"]'); await wait(20); }
    const fb = d.querySelector('.score');
    console.log('SIM done, score:', fb && fb.textContent, '| bubbles:', d.querySelectorAll('.bubble').length);
    // copy all
    const copyBtn = d.querySelector('[data-action="copy"][data-copy="all"]'); click(copyBtn); await wait(30);
    // persistence: reload state from localStorage
    const saved = JSON.parse(w.localStorage.getItem('pidelo-bien-v2'));
    console.log('saved view:', saved.view, 'unlocked:', saved.unlocked, 'kit?', !!saved.kit);
  });

  // 2) Salida sector público, eligiendo una región de la lista ampliada
  await run('exit-publico', async ({ d, click, pick, wait }) => {
    await pick('puesto', 'administracion'); await pick('nivel', 'analista'); await pick('sector', 'otro');
    if (d.querySelector('[data-step="region"][data-value="moquegua"]')) throw new Error('more regions shown too early');
    click('[data-action="more-regions"]'); await wait(20);
    await pick('region', 'moquegua'); await pick('tamano', 's4');
    await pick('contrato', 'publico'); await wait(30);
    console.log('EXIT title:', d.querySelector('.exit-title').textContent);
  });

  // 3) Con capacidades simuladas: dueño, IA de personalización y simulador IA
  const fakeClaude = w => {
    const sample = async (input, opts) => {
      const text = 'Mira, entiendo, pero el presupuesto ya está cerrado este año.';
      if (opts && opts.onText) opts.onText({ text, delta: text });
      return { text, truncated: false, modelTierApplied: 'quick' };
    };
    sample.json = async (input) => {
      if (String(input).includes('Evalúa el desempeño')) return { puntaje: 7, bien: ['Abriste con tu aporte'], mejorar: ['Cierra con una fecha'], frase: '¿Lo vemos el martes?' };
      return { whatsapp: 'Hola, Ana. ¿Cómo está? (IA)', speech: { apertura: 'Apertura IA', prueba: 'Prueba IA', mercado: 'Mercado IA', pedido: 'Pedido IA S/ 2,650', cierre: 'Cierre IA' }, objeciones: [{ id: 'presupuesto', responder: 'Respuesta IA presupuesto' }], correo: 'Correo IA' };
    };
    const user = { isOwner: async () => true };
    const downloads = { save: async () => ({ status: 'saved' }) };
    return { use: async name => ({ sample, user, downloads })[name] || null };
  };
  await run('owner-ai', async ({ d, click, pick, type, check, wait }) => {
    await pick('puesto', 'datos'); await pick('nivel', 'senior'); await pick('sector', 'banca'); await pick('region', 'lima'); await pick('tamano', 's4');
    await pick('contrato', 'indefinido'); await pick('experiencia', 'e5'); await pick('antiguedad', 't2');
    type('#sueldo', '5200'); click('[data-action="salary-next"]'); await wait(30);
    await pick('aumento', 'a24'); await pick('funciones', 'mas'); await pick('logros', 'alguno'); await pick('empresa', 'crece'); await wait(40);
    console.log('RESULT2 stamp:', d.querySelector('.stamp').textContent);
    click('[data-action="open-paywall"]'); await wait(30);
    const owner = d.querySelector('.owner');
    console.log('owner box visible:', owner && !owner.hidden);
    click('[data-action="owner-unlock"]'); await wait(40);
    click('[data-action="build-kit"]'); await wait(40);
    const pol = d.querySelector('[data-action="polish"]');
    console.log('polish visible:', pol && !pol.hidden, '| download visible:', !d.querySelector('[data-action="download"]').hidden);
    click(pol); await wait(80);
    console.log('after polish WA:', d.querySelector('.say').textContent, '| status:', d.getElementById('ai-status').textContent);
    const aiStart = d.querySelector('[data-action="sim-start"][data-mode="ia"]');
    console.log('sim IA button visible:', aiStart && !aiStart.hidden);
    click(aiStart); await wait(30);
    d.querySelector('#sim-input').value = 'Quiero proponer un ajuste a S/ 6,000 por mis resultados del año.'; click('[data-action="sim-send"]'); await wait(60);
    d.querySelector('#sim-input').value = 'Entiendo, ¿podemos fijar la revisión para enero?'; click('[data-action="sim-send"]'); await wait(60);
    click('[data-action="sim-finish"]'); await wait(80);
    console.log('IA sim score:', d.querySelector('.score') && d.querySelector('.score').textContent, '| boss bubbles:', d.querySelectorAll('.bubble.boss').length);
    click('[data-action="download"]'); await wait(30);
  }, { claude: fakeClaude });

  console.log('\nERRORS:', errors.length ? errors.join('\n') : 'none');
  if (errors.length) process.exit(1);
})().catch(e => { console.error('TEST FAILURE', e); process.exit(1); });
