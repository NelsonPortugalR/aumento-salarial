# Versión web en Netlify

## Dónde está

| Qué | Dónde |
| --- | --- |
| Sitio | https://pidelo-bien.netlify.app |
| Panel de validación | https://pidelo-bien.netlify.app/panel (pide el token del panel) |
| Administración | https://app.netlify.com/projects/pidelo-bien (equipo `nelson1614`) |

Mientras no haya dominio propio, el sitio no se indexa (`X-Robots-Tag: noindex`): se puede compartir el enlace, pero no aparece en Google.

## Qué se publica

`bash build.sh` arma `web/` (no se versiona) con `web-src/build.mjs`:

- `index.html` y `app.js`: la misma app de `01_head.html` a `50_ai.js`, más `12_web.js`, que activa la medición y el aporte. Usa fuentes propias, sin Google Fonts.
- `terminos`, `privacidad`, `libro-de-reclamaciones`, `reclamo-recibido`, `panel` y `404`, desde `web-src/paginas/`. Los datos del proveedor salen de `CONFIG.legal` en `10_data.js`; si falta alguno, la página lo muestra como pendiente y el build lo avisa.
- `_headers` (CSP sin scripts en línea ni terceros, HSTS y noindex), `robots.txt`, `favicon.svg` y `og.png`, la imagen que muestran WhatsApp, LinkedIn y Facebook al compartir. Se regenera con `NODE_PATH="$(npm root -g)" node web-src/og.cjs`.

Funciones (`netlify/functions/`), con datos en Netlify Blobs (servidores en EE. UU.):

| Ruta | Qué hace | Guarda |
| --- | --- | --- |
| `POST /api/evento` | Paso del embudo, con un id aleatorio por pestaña | Una clave `día/sesión/tiempo~evento~detalle`, sin respuestas ni sueldo |
| `POST /api/aporte` | Aporte de quien toca "Sí, aportar mi dato" | El registro anónimo validado contra los catálogos, sin IP |
| `POST /api/reclamo` | Asigna el número correlativo de la hoja | Solo el número y la fecha; la hoja va a Netlify Forms |
| `GET /api/resumen`, `GET /api/exportar` | Panel: embudo, aportes y descargas (con el token) | Nada |
| `POST /api/retirar` | Borra un aporte por su código (o una sesión de prueba) | Nada |
| `limpieza` (día 2 de cada mes) | Borra eventos de más de 2 años y aportes de más de 5 | Nada |

`/api/evento` y `/api/aporte` tienen límite de solicitudes por IP. El plan gratuito permite dos reglas.

## Cómo desplegar

Recomendado: conectar el repositorio para que cada push despliegue solo. En Netlify, entra a Project configuration, luego a Build & deploy y a Link repository, y elige `NelsonPortugalR/aumento-salarial` con la rama de producción. El comando y la carpeta ya están en `netlify.toml`. Los PR de datos de cada mes tendrán su vista previa.

A mano, desde la carpeta del repo: `npm run build && npx netlify deploy --prod` (la primera vez pide `netlify login` y `netlify link`). Este camino sube solo `web/` y las funciones.

Ojo: el despliegue que construye en Netlify a partir de la carpeta local, como el de la integración con Claude, sube la carpeta completa. Hazlo desde una copia limpia para no subir `data/private/` ni `data/raw/`:

```bash
rm -rf /tmp/pb && mkdir /tmp/pb && git archive HEAD | tar -x -C /tmp/pb
```

## Dominio propio

1. En Netlify, Domain management y luego Add a domain; sigue los pasos de DNS. El dominio `.netlify.app` redirige solo al nuevo.
2. Agrega la variable `INDEXAR=1` (alcance Builds) y vuelve a desplegar: se quita el noindex y `robots.txt` deja pasar a los buscadores.
3. La imagen para compartir y las URL usan la variable `URL` que Netlify pone al construir, así que se actualizan solas.
4. Completa `CONFIG.legal` (razón social, RUC, domicilio, correo y código de inscripción del banco de datos).

## Libro de Reclamaciones

- Activa el aviso por correo: en Forms, entra a `libro-reclamaciones`, luego a Form notifications y agrega Email notification.
- La página ya le muestra a la persona su constancia con número, para guardar o imprimir. Responde al correo que dejó, citando el número de hoja, en un plazo máximo de 15 días hábiles.
- Conserva las hojas al menos dos años: exporta el CSV desde Forms de vez en cuando.

## Medición y panel

- Eventos: `visit` (precio, origen y celular o computadora), `test_start`, `step` (cada pregunta), `test_complete` (recomendación y zona), `exit_route`, `paywall_view`, `pay_click`, `wa_click`, `code_ok`, `code_bad`, `kit_built`, `sim_start`, `polish`, `share`, `contribute`, `copy`, `download`, `method_view`, `privacy_view` y `restart`. `paid` llega con el webhook de pago.
- Campañas: agrega `?utm_source=meta` (o `?ref=...`) a los enlaces. El panel agrupa por origen. Los resultados compartidos llegan con `?ref=compartido`.
- Tus propias pruebas: abre una vez `https://pidelo-bien.netlify.app/?interno=1` en cada navegador que uses. Ese navegador deja de medir y de enviar aportes; con `?interno=0` vuelve a contar.
- El token del panel no está en el repositorio: solo su huella SHA-256, en `netlify/lib/acceso.mjs`. Para cambiarlo, genera un token nuevo, pega su huella ahí (el comando está en el archivo) y despliega. Si defines la variable `PANEL_TOKEN` en Netlify, esa manda sobre la huella.

## Aportes de sueldo

- Al mes, en el panel, "Aportes (JSONL)". Guárdalo en `data/private/respuestas/aportes_AAAA-MM-DD.jsonl`, corre `npm run data:model` y revisa `data/RESPUESTAS.md`.
- Si alguien pide borrar su aporte, usa "Retirar un aporte" en el panel con el código que le mostró la página.

## Precio y pagos

- Con un solo precio: `CONFIG.payUrl` (link de Culqi) y `CONFIG.whatsapp` para pedir el código.
- Prueba A/B: llena los dos `payUrl` de `CONFIG.priceTest` (un link de S/ 29.90 y otro de S/ 49.90). Se activa sola, cada navegador ve siempre el mismo precio y el panel compara las dos variantes.
- Límite conocido: el desbloqueo por código ocurre en el navegador y el kit se arma ahí, así que alguien con conocimientos técnicos puede saltárselo. Sirve para validar la disposición a pagar. Antes de vender a escala, el pago debe emitir un token que valide el servidor (webhook de Culqi, `CLAUDE.md` punto 5).
