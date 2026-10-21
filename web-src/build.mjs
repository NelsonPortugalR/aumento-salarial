// Arma la versión web (Netlify) en web/: la app, las páginas legales, el Libro de Reclamaciones y el panel.
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

/* 1) Configuración y catálogos, del mismo código que usa la app */
const D = vm.runInContext(rd('10_data.js') + '\n;({ CONFIG, LEVELS, ROLES, SECTORS, REGIONS, SIZES, CONTRACTS, EXPIRY, EXPERIENCE, TENURE, LASTRAISE, FUNCTIONS, RESULTS, COMPANY, STEPS, EXIT_ROUTES })', vm.createContext({}));
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
  '<meta name="theme-color" content="#16233D">'
].filter(Boolean).join('\n');
const SOCIAL = `<meta property="og:type" content="website">
<meta property="og:locale" content="es_PE">
<meta property="og:site_name" content="${C.brand}">
<meta property="og:title" content="¿Te toca un aumento? Haz el test gratis">
<meta property="og:description" content="En 90 segundos comparas tu sueldo con el mercado peruano y sabes si es momento de pedir y cuánto.">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`;
const LEGAL_LINKS = `<p class="legal-links"><a href="/terminos">Términos</a><a href="/privacidad">Privacidad</a><a class="lr" href="/libro-de-reclamaciones"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 7h2.5M6.5 10h2.5M15.5 7h2M15.5 10h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>Libro de Reclamaciones</a></p>`;

/* 3) La app */
const SCRIPTS = ['10_data.js', '12_web.js', '15_bands.js', '20_engine.js', '30_kit.js', '40_ui.js', '50_ai.js'];
fs.writeFileSync(path.join(OUT, 'app.js'), SCRIPTS.map(rd).join('\n'));
let index = head
  .replace(/<link rel="preconnect"[^\n]*\n/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com[^\n]*\n/, FONTS + '\n')
  .replace(/(<meta name="description"[^\n]*\n)/, `$1${META}\n${SOCIAL}\n`) + rd('02_body.html').replace('<!--LEGAL-->', LEGAL_LINKS) + '<script src="/app.js"></script>\n</body>\n</html>\n';
if (/fonts\.googleapis|fonts\.gstatic/.test(index)) throw new Error('quedó una referencia a Google Fonts en index.html');
fs.writeFileSync(path.join(OUT, 'index.html'), index);

/* 4) Páginas: legales, Libro de Reclamaciones, panel y 404 */
const L = C.legal || {};
const pending = [];
const legal = (k, label) => {
  if (L[k]) return k === 'correo' ? `<a href="mailto:${L[k]}">${L[k]}</a>` : L[k];
  pending.push(label);
  return `<span class="pendiente">${label} por completar</span>`;
};
const soles = n => 'S/ ' + Number(n).toFixed(2);
const precios = (C.priceTest || []).length > 1 && C.priceTest.every(t => t.payUrl)
  ? C.priceTest.map(t => soles(t.price)).join(' o ') : soles(C.price);
const VARS = {
  marca: C.brand, sitio: SITE, consentimiento: C.consentVersion, precio: precios,
  razonSocial: legal('razonSocial', 'Razón social'), ruc: legal('ruc', 'RUC'), domicilio: legal('domicilio', 'Domicilio'), correo: legal('correo', 'Correo de contacto'),
  registro: legal('registro', 'Código de inscripción del banco de datos')
};
const fill = s => s.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in VARS)) throw new Error('variable desconocida ' + m); return VARS[k]; });

for (const file of fs.readdirSync(path.join(SRC, 'paginas')).filter(f => f.endsWith('.html')).sort()) {
  const raw = fs.readFileSync(path.join(SRC, 'paginas', file), 'utf8');
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\n/);
  if (!m) throw new Error(`${file}: falta la cabecera JSON`);
  const meta = JSON.parse(m[1]);
  const body = fill(raw.slice(m[0].length));
  const html = `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
${meta.private && INDEX ? '<meta name="robots" content="noindex">\n' : ''}${META}
${FONTS}
<style>${BASE_CSS}${PAGES_CSS}</style>
</head>
<body>
<header class="top wrap${meta.wide ? ' wide' : ''}">
  <a class="brand" href="/">${C.brand}</a>
  <span class="tag">${meta.tag || 'Versión de validación'}</span>
</header>
<main class="wrap doc${meta.wide ? ' wide' : ''}">
${body}</main>
<footer class="foot wrap${meta.wide ? ' wide' : ''}">
  <p>Referencia de mercado, no asesoría legal ni promesa de aumento.</p>
  ${LEGAL_LINKS}
</footer>
${meta.script ? `<script src="/js/${meta.script}"></script>\n` : ''}</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, file), html);
}
for (const f of fs.readdirSync(path.join(SRC, 'js'))) fs.copyFileSync(path.join(SRC, 'js', f), path.join(OUT, 'js', f));
fs.cpSync(path.join(SRC, 'static'), OUT, { recursive: true });

/* 5) Cabeceras y robots */
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
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\n${INDEX ? 'Allow: /' : 'Disallow:'}\nDisallow: /panel\nDisallow: /api/\n`);

/* 6) Revisión de sintaxis */
for (const f of ['app.js', ...fs.readdirSync(path.join(OUT, 'js')).map(f => 'js/' + f)]) execFileSync(process.execPath, ['--check', path.join(OUT, f)]);
console.log(`WEB OK: ${fs.readdirSync(OUT).length} archivos en web/ (${SITE}${INDEX ? ', indexable' : ', sin indexar'})`);
if (pending.length) console.log('Datos legales por completar en CONFIG.legal (10_data.js): ' + [...new Set(pending)].join(', '));
