// Huella SHA-256 del token del panel. El token no se versiona y no se puede deducir de su huella.
// Para cambiarlo: genera un token nuevo, saca su huella con
//   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" TOKEN
// y pégala aquí. Si existe la variable PANEL_TOKEN en Netlify, esa manda.
export const PANEL_HUELLA = '4f00ae8464cee199dcbc75f763e06e0d7e783d6ae5059566ca8a957a2988808e';
