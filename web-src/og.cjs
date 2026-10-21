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
  await browser.close();
  console.log('og.png listo');
})();
