// Cobros: servicio de pagos central (Mercado Pago Checkout Pro) para Pídelo Bien, Lo Tuyo y Buen Partido.
// La lógica está en nucleo.js (se prueba sin Deno); aquí solo se conecta con Supabase y con la red.
// Secreto necesario: MP_ACCESS_TOKEN (Access Token de producción de Mercado Pago). Sin él, el cobro figura
// como no disponible y las páginas siguen como antes. Se publica sin verificación de JWT: las rutas públicas
// no exponen datos y el panel se valida con su propio token.
import { atender, CORS, limitador } from './nucleo.js';
import { tiendaSupabase } from './tienda.js';

const url = Deno.env.get('SUPABASE_URL') ?? '';
let clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
try {
  const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  if (nuevas && nuevas.default) clave = nuevas.default;   // las claves antiguas dejan de servir a fines de 2026
} catch (_e) { /* solo claves antiguas */ }

const tienda = tiendaSupabase({ url, clave, fetch });
const base = url.replace(/\/+$/, '') + '/functions/v1/cobros';
// Un limitador por tope (las claves llevan el tipo de ruta y la IP), con ventanas de 10 minutos
const limitadores = new Map<number, (k: string) => boolean>();
const limite = (k: string, max: number) => {
  if (!limitadores.has(max)) limitadores.set(max, limitador(max, 10 * 60e3));
  return limitadores.get(max)!(k);
};

Deno.serve(async (req: Request) => {
  const texto = req.method === 'POST' ? (await req.text()).slice(0, 20000) : '';
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || (req.headers.get('cf-connecting-ip') ?? '');
  try {
    const r = await atender(
      { method: req.method, url: new URL(req.url), texto, ip, panel: req.headers.get('x-panel') ?? '' },
      { tienda, token: Deno.env.get('MP_ACCESS_TOKEN') ?? '', base, fetch, limite, ahora: () => new Date(), log: console.error }
    );
    return new Response(r.body, { status: r.status, headers: r.headers });
  } catch (e) {
    console.error('cobros:', e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: 'interno' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
});
