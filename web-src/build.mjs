// Arma la versión web (Netlify) en web/: la app, las páginas legales, las guías, los sueldos por puesto y el panel.
// También genera netlify/lib/catalogos.mjs para que las funciones validen con los mismos catálogos que la app.
// Variables de entorno: URL (la pone Netlify al construir; dirección principal del sitio) e INDEXAR=1 para
// permitir que los buscadores indexen el sitio (por defecto no, hasta tener dominio y datos legales).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'web-src');
const OUT = path.join(ROOT, 'web');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SITE = (process.env.URL || 'https://pidelo-bien.netlify.app').replace(/\/$/, '');
const INDEX = process.env.INDEXAR === '1';
const HOY = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);   // fecha de Lima

/* 1) Configuración, catálogos y motor, del mismo código que usa la app */
const D = vm.runInContext(['10_data.js', '15_bands.js', '20_engine.js'].map(rd).join('\n') +
  '\n;({ CONFIG, MARKET, Engine, LEVELS, ROLES, SECTORS, REGIONS, SIZES, CONTRACTS, EXPIRY, EXPERIENCE, TENURE, LASTRAISE, FUNCTIONS, RESULTS, COMPANY, STEPS, EXIT_ROUTES })', vm.createContext({}));
const C = D.CONFIG;
const ids = arr => arr.map(x => x.id);
const catalogos = {
  puesto: ids(D.ROLES), nivel: ids(D.LEVELS), sector: ids(D.SECTORS), region: ids(D.REGIONS), tamano: ids(D.SIZES),
  contrato: ids(D.CONTRACTS).filter(c => !D.EXIT_ROUTES.includes(c)), vence: ids(D.EXPIRY), experiencia: ids(D.EXPERIENCE),
  antiguedad: ids(D.TENURE), aumento: ids(D.LASTRAISE), funciones: ids(D.FUNCTIONS), logros: ids(D.RESULTS), empresa: ids(D.COMPANY)
};
const variantes = [...new Set([C.price, ...(C.priceTest || []).map(t => t.price)])].map(p => 'p' + Math.round(p * 100));
fs.writeFileSync(path.join(ROOT, 'netlify/lib/catalogos.mjs'),
  '// Generado por web-src/build.mjs a partir de 10_data.js. No editar a mano.\n' +
  `export const CATALOGOS = ${JSON.stringify(catalogos)};\n` +
  `export const PASOS = ${JSON.stringify(ids(D.STEPS))};\n` +
  `export const SALIDAS = ${JSON.stringify(D.EXIT_ROUTES)};\n` +
  `export const VARIANTES = ${JSON.stringify(variantes)};\n` +
  `export const CONSENTIMIENTO = ${JSON.stringify(C.consentVersion)};\n`);

/* 2) Piezas comunes */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'sueldos'), { recursive: true });
const head = rd('01_head.html');
const BASE_CSS = head.slice(head.indexOf('<style>') + 7, head.indexOf('</style>'));
const PAGES_CSS = fs.readFileSync(path.join(SRC, 'paginas.css'), 'utf8');
const FONTS = `<link rel="preload" href="/fonts/atkinson-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/bricolage.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{font-family:"Atkinson Hyperlegible";font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/atkinson-400.woff2) format("woff2")}
@font-face{font-family:"Atkinson Hyperlegible";font-style:normal;font-weight:700;font-display:swap;src:url(/fonts/atkinson-700.woff2) format("woff2")}
@font-face{font-family:"Atkinson Hyperlegible";font-style:italic;font-weight:400;font-display:swap;src:url(/fonts/atkinson-400-italic.woff2) format("woff2")}
@font-face{font-family:"Bricolage Grotesque";font-style:normal;font-weight:500 800;font-display:swap;src:url(/fonts/bricolage.woff2) format("woff2")}
</style>`;
const META = [
  INDEX ? '' : '<meta name="robots" content="noindex">',
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<meta name="theme-color" content="#16233D">'
].filter(Boolean).join('\n');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
// Open Graph por página: título y descripción propios, imagen y marca comunes
const social = (title, description, url, type = 'website') => `<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:locale" content="es_PE">
<meta property="og:site_name" content="${C.brand}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(C.brand)}: ¿te toca un aumento? Test salarial gratis">
<meta name="twitter:card" content="summary_large_image">`;
const LEGAL_LINKS = `<p class="legal-links"><a href="/terminos">Términos</a><a href="/privacidad">Privacidad</a><a class="lr" href="/libro-de-reclamaciones"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 7h2.5M6.5 10h2.5M15.5 7h2M15.5 10h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>Libro de Reclamaciones</a></p>`;

/* 3) La app (portada) */
const SCRIPTS = ['10_data.js', '12_web.js', '15_bands.js', '20_engine.js', '30_kit.js', '40_ui.js', '50_ai.js'];
fs.writeFileSync(path.join(OUT, 'app.js'), SCRIPTS.map(rd).join('\n'));
const TITULO_HOME = 'Test salarial gratis: ¿te toca pedir un aumento? | Pídelo Bien';
const DESC_HOME = 'Compara tu sueldo con el mercado peruano 2026 (datos del INEI y guías salariales), descubre si es buen momento para pedir un aumento y cuánto pedir. Gratis y anónimo.';
const faq = JSON.parse(fs.readFileSync(path.join(SRC, 'faq.json'), 'utf8'));
const faqHTML = faq.map(f => `<details><summary>${esc(f.q)}</summary><p class="faq-a">${esc(f.a)}</p></details>`).join('\n');
const homeExtra = fs.readFileSync(path.join(SRC, 'home.html'), 'utf8').replace('<!--FAQ-->', faqHTML);
const LD_HOME = ld({
  '@context': 'https://schema.org', '@type': 'WebApplication', name: C.brand, url: SITE + '/',
  description: DESC_HOME, applicationCategory: 'FinanceApplication', operatingSystem: 'Web', inLanguage: 'es-PE'
}) + ld({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
});
let index = head
  .replace(/<title>.*<\/title>/, `<title>${TITULO_HOME}</title>`)
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${DESC_HOME}">`)
  .replace(/<link rel="preconnect"[^\n]*\n/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com[^\n]*\n/, FONTS + '\n')
  .replace(/(<meta name="description"[^\n]*\n)/, `$1${META}\n${social(TITULO_HOME, DESC_HOME, SITE + '/')}\n${LD_HOME}\n`)
  + rd('02_body.html')
    .replace('<!--LEGAL-->', LEGAL_LINKS)
    .replace('<footer class="foot wrap">', homeExtra + '\n<footer class="foot wrap">')
  + '<script src="/app.js"></script>\n</body>\n</html>\n';
if (/fonts\.googleapis|fonts\.gstatic/.test(index)) throw new Error('quedó una referencia a Google Fonts en index.html');
fs.writeFileSync(path.join(OUT, 'index.html'), index);

/* 4) Plantilla de páginas */
const L = C.legal || {};
const pending = [];
const legal = (k, label) => {
  if (L[k]) return k === 'correo' ? `<a href="mailto:${L[k]}">${L[k]}</a>` : L[k];
  pending.push(label);
  return `<span class="pendiente">${label} por completar</span>`;
};
const VARS = {
  marca: C.brand, sitio: SITE, consentimiento: C.consentVersion,
  razonSocial: legal('razonSocial', 'Razón social'), ruc: legal('ruc', 'RUC'), domicilio: legal('domicilio', 'Domicilio'), correo: legal('correo', 'Correo de contacto'),
  registro: legal('registro', 'Código de inscripción del banco de datos')
};
const fill = s => s.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in VARS)) throw new Error('variable desconocida ' + m); return VARS[k]; });
const paginas = [];   // para el sitemap: [ruta, indexable]

function renderPage(file, meta, body) {
  const ruta = meta.ruta ?? '/' + file.replace(/\.html$/, '').replace(/\/index$/, '/');
  const url = SITE + ruta;
  const indexable = !meta.private && !['404', 'reclamo-recibido'].includes(file.replace(/\.html$/, ''));
  if (indexable) paginas.push(ruta);
  const extraLd = (meta.article ? ld({
    '@context': 'https://schema.org', '@type': 'Article', headline: meta.title.split('|')[0].trim(),
    description: meta.description, inLanguage: 'es-PE', mainEntityOfPage: url,
    datePublished: '2026-10-21', dateModified: HOY,
    author: { '@type': 'Organization', name: C.brand, url: SITE + '/' },
    publisher: { '@type': 'Organization', name: C.brand, url: SITE + '/' }
  }) : '') + (meta.migas ? ld({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: meta.migas.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + item }))
  }) : '');
  const migasHTML = meta.migas
    ? `<nav class="migas" aria-label="Estás en">${meta.migas.map(([n, i], k) => k === meta.migas.length - 1 ? `<span aria-current="page">${esc(n)}</span>` : `<a href="${i}">${esc(n)}</a>`).join('<span class="sep" aria-hidden="true">›</span>')}</nav>\n`
    : '';
  const html = `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
${meta.private && INDEX ? '<meta name="robots" content="noindex">\n' : ''}${META}
${social(meta.title, meta.description, url, meta.article ? 'article' : 'website')}
${extraLd}${FONTS}
<style>${BASE_CSS}${PAGES_CSS}</style>
</head>
<body>
<header class="top wrap${meta.wide ? ' wide' : ''}">
  <a class="brand" href="/">${C.brand}</a>
  <span class="tag">${meta.tag || 'Versión de validación'}</span>
</header>
<main class="wrap doc${meta.wide ? ' wide' : ''}">
${migasHTML}${body}</main>
<footer class="foot wrap${meta.wide ? ' wide' : ''}">
  <p>Referencia de mercado, no asesoría legal ni promesa de aumento.</p>
  ${LEGAL_LINKS}
</footer>
${meta.script ? `<script src="/js/${meta.script}"></script>\n` : ''}</body>
</html>
`;
  const destino = path.join(OUT, file);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html);
}

for (const file of fs.readdirSync(path.join(SRC, 'paginas')).filter(f => f.endsWith('.html')).sort()) {
  const raw = fs.readFileSync(path.join(SRC, 'paginas', file), 'utf8');
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\n/);
  if (!m) throw new Error(`${file}: falta la cabecera JSON`);
  renderPage(file, JSON.parse(m[1]), fill(raw.slice(m[0].length)));
}

/* 5) Sueldos por puesto, generados del mismo modelo que usa el test */
const soles = n => 'S/\u00A0' + Math.round(n).toLocaleString('en-US');
const SLUGS = {
  administracion: 'administracion', contabilidad: 'contabilidad', finanzas: 'finanzas', rrhh: 'recursos-humanos',
  logistica: 'logistica', ventas: 'ventas', marketing: 'marketing', atencion: 'atencion-al-cliente',
  software: 'desarrollo-de-software', datos: 'datos-y-bi', soporte: 'soporte-ti', ing_industrial: 'ingenieria-industrial',
  mantenimiento: 'mantenimiento', ing_civil: 'ingenieria-civil', ing_minas: 'mineria', seguridad: 'seguridad-y-salud-ocupacional',
  legal: 'legal', enfermeria: 'enfermeria', salud: 'salud', docencia: 'docencia'
};
const EXP_TIPICA = { asistente: 'e1', analista: 'e3', senior: 'e5', supervisor: 'e5', jefe: 'e10', gerente: 'e10' };
const CONFIANZA = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const mesLargo = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-PE', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const actualizado = mesLargo(D.MARKET.version);
const bandasDe = puesto => D.LEVELS.map(l => ({
  nivel: l,
  banda: D.Engine.band({ puesto, nivel: l.id, sector: 'otro', region: 'lima', tamano: 's3', experiencia: EXP_TIPICA[l.id] })
}));
const roles = D.ROLES.filter(r => SLUGS[r.id]);
if (roles.length !== D.ROLES.length - 1) throw new Error('falta un slug para algún puesto');
const notaPerfil = `<p class="fine">Sueldos brutos mensuales de un perfil de referencia: Lima Metropolitana, empresa de 101 a 500 personas y experiencia típica de cada nivel. En provincias las bandas son menores; en empresas de más de 2,000 personas, mayores. El test ajusta por tu región, sector, tamaño de empresa y experiencia.</p>`;
const comoSeCalcula = `<h2>Cómo lo calculamos</h2>
<p>Las bandas salen de un modelo propio sobre la Encuesta Nacional de Hogares del INEI (2022-2025), calibrado con guías salariales 2026 basadas en planillas, y llevado a la fecha con el crecimiento de los sueldos formales. La confianza baja cuando una combinación tiene pocos datos. Es una referencia de mercado, no la política salarial de una empresa concreta.</p>`;

for (const r of roles) {
  const filas = bandasDe(r.id);
  const tabla = `<div class="tabla-wrap"><table class="tabla banda-niveles"><thead><tr><th scope="col">Nivel</th><th class="n" scope="col">P25</th><th class="n" scope="col">Mediana</th><th class="n" scope="col">P75</th><th scope="col">Confianza</th></tr></thead><tbody>
${filas.map(({ nivel, banda }) => `<tr><td>${esc(nivel.label)}</td><td class="n">${soles(banda.p25)}</td><td class="n"><b>${soles(banda.p50)}</b></td><td class="n">${soles(banda.p75)}</td><td>${CONFIANZA[banda.confidence]}</td></tr>`).join('\n')}
</tbody></table></div>`;
  const analista = filas[1].banda, jefe = filas[4].banda;
  const relacionados = [...roles].sort((a, b) => Math.abs(bandaCache(a.id) - bandaCache(r.id)) - Math.abs(bandaCache(b.id) - bandaCache(r.id)) || a.id.localeCompare(b.id)).filter(x => x.id !== r.id).slice(0, 4);
  renderPage(`sueldos/${SLUGS[r.id]}.html`, {
    title: `Sueldos en ${r.label} en el Perú 2026: bandas por nivel | ${C.brand}`,
    description: `Cuánto se gana en ${r.label.toLowerCase()} en el Perú: de ${soles(analista.p50)} de mediana a nivel analista a ${soles(jefe.p50)} como jefe de área. Bandas P25-P75 por nivel, actualizadas a ${actualizado}.`,
    tag: 'Sueldos 2026',
    migas: [['Inicio', '/'], ['Sueldos', '/sueldos/'], [r.label, `/sueldos/${SLUGS[r.id]}`]]
  }, `<h1>Sueldos en ${esc(r.label)} en el Perú</h1>
<p class="updated">Bandas actualizadas a ${actualizado}.</p>
<p>En ${esc(r.label.toLowerCase())}, la mediana del mercado peruano va de <b>${soles(filas[0].banda.p50)}</b> para un asistente a <b>${soles(filas[5].banda.p50)}</b> para una gerencia, con <b>${soles(analista.p50)}</b> a nivel analista. La mitad de los analistas de este perfil gana entre ${soles(analista.p25)} y ${soles(analista.p75)}.</p>
${tabla}
${notaPerfil}
<p><a class="btn" href="/">Compara tu sueldo exacto con el test gratis</a></p>
<p class="fine">El test afina estas bandas con tu región, sector, tamaño de empresa y experiencia, te dice si es buen momento para pedir y arma tu caso en 90 segundos, sin registro.</p>
${comoSeCalcula}
<h2>También te puede servir</h2>
<ul>
${relacionados.map(x => `  <li><a href="/sueldos/${SLUGS[x.id]}">Sueldos en ${esc(x.label.toLowerCase())}</a></li>`).join('\n')}
  <li><a href="/como-pedir-aumento-de-sueldo">Cómo pedir un aumento de sueldo</a></li>
  <li><a href="/pretension-salarial">Qué responder sobre tu pretensión salarial</a></li>
</ul>`);
}
function bandaCache(id) {
  bandaCache.m = bandaCache.m || {};
  if (!(id in bandaCache.m)) bandaCache.m[id] = D.Engine.band({ puesto: id, nivel: 'analista', sector: 'otro', region: 'lima', tamano: 's3', experiencia: 'e3' }).p50;
  return bandaCache.m[id];
}

renderPage('sueldos/index.html', {
  title: `Sueldos por puesto en el Perú 2026: bandas por área y nivel | ${C.brand}`,
  description: `Bandas salariales 2026 de ${roles.length} áreas en el Perú, de asistente a gerente, con datos del INEI y guías salariales. Actualizadas a ${actualizado}.`,
  tag: 'Sueldos 2026',
  ruta: '/sueldos/',
  migas: [['Inicio', '/'], ['Sueldos', '/sueldos/']]
}, `<h1>Sueldos por puesto en el Perú</h1>
<p class="updated">Bandas actualizadas a ${actualizado}.</p>
<p>Mediana bruta mensual a nivel analista en Lima (empresa de 101 a 500 personas). Entra a cada área para ver la banda completa, de asistente a gerente.</p>
<ul class="sueldos-lista">
${[...roles].sort((a, b) => bandaCache(b.id) - bandaCache(a.id)).map(r => `  <li><a href="/sueldos/${SLUGS[r.id]}"><b>${esc(r.label)}</b><span>Mediana analista: ${soles(bandaCache(r.id))}</span></a></li>`).join('\n')}
</ul>
${notaPerfil}
<p><a class="btn" href="/">Compara tu sueldo exacto con el test gratis</a></p>
${comoSeCalcula}`);

/* 6) Archivos estáticos, cabeceras, robots y sitemap */
for (const f of fs.readdirSync(path.join(SRC, 'js'))) fs.copyFileSync(path.join(SRC, 'js', f), path.join(OUT, 'js', f));
fs.cpSync(path.join(SRC, 'static'), OUT, { recursive: true });

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
fs.writeFileSync(path.join(OUT, '_headers'), `/*
  Content-Security-Policy: ${CSP}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()
  Strict-Transport-Security: max-age=31536000
${INDEX ? '' : '  X-Robots-Tag: noindex\n'}
/panel
  X-Robots-Tag: noindex
  Cache-Control: no-store

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\n${INDEX ? 'Allow: /' : 'Disallow:'}\nDisallow: /panel\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
const rutas = ['/', ...paginas.filter(p => p !== '/panel')];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rutas.map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${HOY}</lastmod></url>`).join('\n')}
</urlset>
`);

/* 7) Revisión de sintaxis */
for (const f of ['app.js', ...fs.readdirSync(path.join(OUT, 'js')).map(f => 'js/' + f)]) execFileSync(process.execPath, ['--check', path.join(OUT, f)]);
const total = fs.readdirSync(OUT).length + fs.readdirSync(path.join(OUT, 'sueldos')).length;
console.log(`WEB OK: ${total} archivos en web/ con ${rutas.length} rutas en el sitemap (${SITE}${INDEX ? ', indexable' : ', sin indexar'})`);
if (pending.length) console.log('Datos legales por completar en CONFIG.legal (10_data.js): ' + [...new Set(pending)].join(', '));
