/* ============================================================
   VERSIÓN WEB (Netlify): este archivo entra solo en web/app.js
   ============================================================ */
Object.assign(CONFIG, {
  web: true,
  collectUrl: '/api/aporte',
  eventsUrl: '/api/evento',
  // Motor de cobros compartido con Lo Tuyo, Buen Partido y Buen Ojo (cobros/ en este repositorio)
  checkout: 'https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros'
});
