// Cumple los plazos de la política de privacidad: borra eventos de más de 2 años y aportes de más de 5 años.
// Corre el día 2 de cada mes a las 08:23 UTC (03:23 en Lima).
import { getStore } from '@netlify/blobs';
import { limaDia, limaMes } from '../lib/comun.mjs';

const LIMITE_MS = 25000;   // las funciones programadas tienen 30 s; lo que falte se borra el mes siguiente

async function borrarAntes(store, corte, inicio) {
  let borrados = 0;
  const { directories } = await store.list({ directories: true });
  for (const dir of directories.filter(d => d < corte).sort()) {
    const { blobs } = await store.list({ prefix: dir + '/' });
    for (const b of blobs) {
      if (Date.now() - inicio > LIMITE_MS) return borrados;
      await store.delete(b.key);
      borrados++;
    }
  }
  return borrados;
}

export default async () => {
  const inicio = Date.now();
  const now = new Date();
  const eventos = await borrarAntes(getStore('eventos'), limaDia(new Date(now.getTime() - 730 * 86400e3)), inicio);
  const aportes = await borrarAntes(getStore('aportes'), limaMes(new Date(now.getTime() - 5 * 365 * 86400e3)), inicio);
  console.log(`limpieza: ${eventos} eventos y ${aportes} aportes borrados`);
};

export const config = { schedule: '23 8 2 * *' };
