// Genera web-src/static/og.png (imagen para compartir en WhatsApp, LinkedIn y Facebook) a partir de og.html.
// Correr solo si cambia el diseño: NODE_PATH="$(npm root -g)" node web-src/og.cjs (requiere Playwright).
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + path.join(__dirname, 'og.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(__dirname, 'static', 'og.png') });
  // Ícono para iOS (apple-touch-icon): el favicon rasterizado a 180x180
  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  const svg = require('fs').readFileSync(path.join(__dirname, 'static', 'favicon.svg'), 'utf8');
  await icon.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block;width:180px;height:180px}</style>${svg}`);
  await icon.screenshot({ path: path.join(__dirname, 'static', 'apple-touch-icon.png'), omitBackground: true });
  await browser.close();
  console.log('og.png y apple-touch-icon.png listos');
})();
