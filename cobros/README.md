# Motor de cobros central

Un solo servicio de pagos para los tests del dueño: Pídelo Bien, Buen Partido, Buen Ojo, Lo Tuyo y, cuando exista, el test de pareja. Cobra con Mercado Pago Checkout Pro (tarjeta de crédito o débito, en soles, un solo pago), confirma cada pago directamente con Mercado Pago y entrega un código de acceso por compra para abrir lo comprado en otro equipo. También guarda el Libro de Reclamaciones de Lo Tuyo, Buen Partido y Buen Ojo, y da al panel de Pídelo Bien las ventas de todas las páginas.

- Función: `supabase/functions/cobros/` (Supabase Edge Function, proyecto "NelsonPortugalR's Project", `unzbrfdqsjjpnokirlsk`). La lógica está en `nucleo.js` y se prueba sin Deno.
- Tablas: `supabase/migrations/20261118120000_cobros.sql` (`cb_productos`, `cb_pedidos`, `cb_accesos`, `cb_config`, `cb_reclamos`, `cb_contadores`). Tienen RLS sin políticas y sin permisos para `anon` ni `authenticated`: solo las usa la función, con la clave secreta del proyecto.
- Dirección pública: `https://unzbrfdqsjjpnokirlsk.supabase.co/functions/v1/cobros`.
- Pruebas: `node cobros/pruebas/cobros.test.mjs` (también corre con `npm test`).

## Cómo se activa

1. Aplicar la migración (SQL Editor de Supabase o `apply_migration`).
2. Publicar la función **sin verificación de JWT** (las rutas públicas no exponen datos; el aviso de Mercado Pago llega sin token): `supabase functions deploy cobros --no-verify-jwt --project-ref unzbrfdqsjjpnokirlsk`.
3. Cargar el secreto `MP_ACCESS_TOKEN` (Access Token de producción de Mercado Pago) en Edge Functions > Secrets. Desde ese momento `disponible` responde `true` y las páginas conectadas muestran el pago con tarjeta, sin volver a desplegarlas.

Sin la clave, cada página sigue como antes (beta, demo o pedido por WhatsApp) y `crear` responde 503.

## Rutas

| Ruta | Para qué |
| --- | --- |
| `GET /disponible?producto=` | `{ disponible }`: hay clave de Mercado Pago y el producto está activo. |
| `GET /cupon?producto=&cupon=` | `{ ok, descuento }` si el cupón existe para ese producto. |
| `POST /crear` `{ producto, variante, volver, cupon? }` | Crea el pedido y la preferencia; devuelve `{ pedido, url, monto }`. El monto sale del catálogo, nunca del navegador. `volver` tiene que ser una página autorizada del producto; Mercado Pago devuelve a quien paga a esa dirección con `?pago=<pedido>`. |
| `GET /estado?pedido=` | Confirma con Mercado Pago. `{ estado, producto, variante, monto, codigo? }`. Estados: `creado`, `pendiente`, `pagado`, `rechazado`, `revisar` (pago por otro monto) y `devuelto`. |
| `POST /aviso` | Aviso de Mercado Pago (webhook). Marca el pago aunque la persona no vuelva a la página. |
| `POST /codigo` `{ codigo, producto }` | `{ ok }`: el código abre ese producto (el prefijo del código tiene que ser el del producto). |
| `POST /reclamo` `{ sitio, … }` | Hoja del Libro de Reclamaciones (Lo Tuyo, Buen Partido o Buen Ojo). Devuelve `{ numero, fecha }`, correlativo por página y año (`000001-2026`). |
| `GET /resumen` (cabecera `x-panel`) | Ventas por producto, variante y día, pedidos del mes por estado y hojas de reclamación. Usa el token del panel de Pídelo Bien (se guarda solo su huella SHA-256 en `cb_config`). |
| `POST /reclamo/respondido` (cabecera `x-panel`) `{ id }` | Marca una hoja como respondida. |

Hay un límite de solicitudes por IP en `crear`, `cupon`, `codigo`, `reclamo` y el panel.

## Cómo se conecta una página

1. Al cargar, `GET /disponible?producto=<id>`. Si es `true`, muestra el pago con tarjeta; si no, deja su comportamiento actual.
2. Al tocar pagar, `POST /crear` con su producto, la variante de precio que le tocó a la persona y `volver: location.origin + '/'`. Guarda el número de pedido (salvo que la página prometa no guardar nada, como Lo Tuyo: entonces abre Mercado Pago en otra pestaña y consulta el estado en memoria) y lleva a la persona a `url`.
3. Al volver con `?pago=<pedido>`, o en la siguiente visita, `GET /estado?pedido=` hasta que diga `pagado`; entonces desbloquea y muestra el `codigo`.
4. En otro equipo, `POST /codigo` con el código y el producto.

## Catálogo

| Producto | Página | Precios (variante: soles) | Prefijo | En el estado de cuenta |
| --- | --- | --- | --- | --- |
| `pidelo-bien-kit` | pidelo-bien.netlify.app | `p2990`: 29.90, `p4990`: 49.90 | PB | PIDELOBIEN |
| `buen-partido-reporte` | buen-partido.netlify.app | `a`: 39, `b`: 59; cupón `PATA20` (20%) | BP | BUENPARTIDO |
| `buen-ojo-reporte` | buen-ojo.netlify.app | `p3900`: 39, `p5900`: 59 | BO | BUENOJO |
| `lo-tuyo-reporte` | lo-tuyo.netlify.app | `unico`: 39 | LT | PORTUGALRI |

Lo Tuyo cobra con nombres neutros ("Reporte personalizado" y PORTUGALRI): el estado de cuenta y el correo de Mercado Pago no dicen de qué se trata. Los precios incluyen IGV.

Para sumar una página (por ejemplo, el test de pareja), una fila en el SQL Editor:

```sql
insert into cb_productos (id, sitio, nombre, precios, cupones, origenes, descriptor, prefijo) values
  ('test-pareja-reporte', 'test-pareja', 'Reporte de pareja',
   '{"unico": 39}', '{}', array['https://DOMINIO', 'https://*--SITIO.netlify.app'], 'TESTPAREJA', 'TP');
```

Al cambiar de dominio, agrega el nuevo origen: `update cb_productos set origenes = origenes || 'https://nuevodominio.pe' where id = '…';`. Para cambiar un precio, cambia la variante aquí y en la página.

## Qué se guarda

De cada pedido: número aleatorio, producto, variante, cupón, monto, estado, número de pago de Mercado Pago, el código entregado y las fechas. Nunca nombre, correo ni datos de tarjeta. De cada código vigente, solo su huella SHA-256 para validarlo. Las hojas de reclamación guardan los datos que exige la ley y se conservan al menos dos años.
