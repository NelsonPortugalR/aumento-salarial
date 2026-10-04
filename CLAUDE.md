# Pídelo Bien — herramienta para negociar sueldo en Perú

Prototipo funcional de un test salarial freemium: test de 12 a 13 preguntas, resultado gratis (posición frente a la mediana, momento, caso) y kit pagado (cifras, método en tres tiempos, speech, maletín, objeciones, simulador del jefe). Mercado: asalariados formales del sector privado peruano. Copy en español peruano, tuteo, sobrio.

## Estado actual

- `pidelo-bien.html` se arma con `build.sh` (`npm run build`) desde archivos separados:
  - `01_head.html` estilos y tokens (claro y oscuro), `02_body.html` estructura.
  - `10_data.js` configuración (`CONFIG`), catálogos del test (6 niveles, 21 puestos, 13 sectores, 25 regiones) y pasos.
  - `15_bands.js` **generado** por `data/pipeline/02_model.py`: anclas, multiplicadores, dispersión, n por celda y contexto 2026 (`MARKET`). No se edita a mano.
  - `20_engine.js` motor determinístico: banda, percentil (banda asimétrica), confianza según datos, caso, momento, recomendación, cifras (ancla, objetivo, piso, escalera, pretensión) y bruto↔neto 2026.
  - `30_kit.js` kit con plantillas (funciona sin IA). `40_ui.js` interfaz. `50_ai.js` IA opcional y simulador.
- Pruebas: `npm test` corre `engine.test.js` (invariantes del motor sobre miles de perfiles) y `flow.test.js` (flujo completo en jsdom).
- Hoy corre como artefacto de claude.ai: la IA usa la cuenta de quien lo abre, no guarda datos y no mide conversiones. Los códigos de acceso son hashes SHA-256 en `CONFIG.codeHashes`.

## Regla de oro

El motor decide (recomendación y cifras) con reglas fijas y auditables. La IA solo redacta. Nunca dejes que un modelo cambie una cifra.

## Lo que hay que construir

1. **Proyecto real.** Pasar a Astro (o Vite) con los mismos módulos; páginas estáticas para SEO (`/`, `/pretension-salarial`, `/renovacion-de-contrato`, `/como-pedir-aumento-de-sueldo`, `/sueldos/[cargo]`). Desplegar en Netlify con dominio propio.
2. **Bandas con datos verificados.** Hecho en su primera versión: ENAHO 2022-2025 más cifras publicadas de Buk 2026 (ver `data/METODOLOGIA.md`). Falta sumar la guía completa de Buk y, más adelante, las respuestas propias del test.
3. **Backend en Supabase** (región sa-east-1): tablas `responses` (anónimas, versión del consentimiento, sin nombre, DNI ni empresa), `events` (embudo), `bands`, `payments`, `access_tokens`. RLS: el público solo inserta en `responses` y `events`.
4. **IA del lado servidor**: función (Netlify o Supabase Edge) con la API de Claude para "Personalizar con IA" y el simulador. Límite por sesión e IP. A la IA no viaja ningún dato que identifique a la persona.
5. **Cobro**: Culqi Checkout (Yape y tarjeta en soles) + webhook que marca el pago y emite un token de acceso al kit. Boleta electrónica automática con un proveedor de facturación con API. Precio en prueba A/B: S/ 29.90 frente a S/ 49.90.
6. **Métricas de validación**: eventos `test_start`, `step`, `test_complete`, `paywall_view`, `pay_click`, `paid`, `kit_built`, `sim_start`. Tablero con: tests completos, inicio a completado, completado a pago, costo por pago, compradores que tuvieron la conversación a 30 días.
7. **Legal**: consentimiento expreso para dato sensible (sueldo, Ley 29733), política de privacidad, banco de datos inscrito ante la autoridad de protección de datos, Libro de Reclamaciones virtual, términos y aviso de "referencia de mercado, no asesoría legal ni promesa de aumento".

## Datos salariales: fuentes y reglas

Las bandas actuales salen de `data/pipeline/` (`npm run data` descarga y recalcula todo; `npm run data:model` solo recalcula). Método, supuestos, validación y límites: `data/METODOLOGIA.md`. Números de la última corrida: `data/RESULTADOS.md`. Los microdatos (`data/raw/`) no se versionan.

| Fuente | Qué aporta | Regla de uso |
| --- | --- | --- |
| Guía Salarial Buk Perú 2026 | Sueldos reales de planilla de 71,143 personas en 1,149 empresas; 207 cargos; P25, P50 y P75 por tamaño de empresa y mediana por industria | Fuente principal para calibrar. Descarga gratuita con formulario; dejar el PDF en `data/raw/` y extraer tablas a `data/bands.json`. No reproducir sus tablas tal cual en el producto. |
| Guía Salarial Michael Page Perú 2027 | Rangos mínimo y máximo de sueldo fijo bruto mensual por posición, industria y tamaño (por facturación); fuerte en jefaturas y gerencias | Requiere cuenta. Su herramienta indica que los datos son para uso dentro de ella: usar solo como control interno de cargos senior, no mostrar ni redistribuir sin permiso. |
| Avisos con sueldo publicado (Computrabajo, Bumeran, LinkedIn) | Rangos ofrecidos actuales | No hacer scraping de LinkedIn (sus condiciones lo prohíben). Revisar condiciones de cada portal antes de automatizar. Por defecto: muestreo manual con un formulario o CSV (fecha, portal, url, puesto normalizado, nivel, ciudad, sector, tamaño, sueldo mínimo y máximo, tipo de contrato). Marcar como "ofrecido" y darle menos peso que lo pagado. |
| Microdatos INEI (ENAHO, EPEN) y MTPE Ponte en Carrera | Base pública por ocupación y región; tramos junior | Línea base para niveles de entrada. |
| Respuestas del propio test | Puesto, nivel, sueldo, ciudad, sector y tamaño, con consentimiento | Gana peso desde unas 30 respuestas por celda. Ninguna celda con menos de 5 respuestas propias se publica sola. |

Modelo: jerárquico con encogimiento (la celda se apoya en la de arriba cuando tiene pocos datos). Guardar por celda: fuente, fecha, número de observaciones y confianza (alta con 50 o más en 12 meses, media con 15 a 49, baja con menos).

Validación de la versión actual frente a 28 medianas publicadas de Buk: diferencia absoluta mediana de 9.6%. Sigue abajo en ventas senior (business developer, −26% a −28%) y en jefaturas de RR.HH. y marketing (−24% a −29%): son los primeros cargos a recalibrar cuando haya más datos de planilla.

## Método del kit

Combina dos métodos, adaptados a Perú: Ramit Sethi para la preparación (qué llevar y cuándo pedir) y Chris Voss para la conversación (cómo hablar en la reunión). No usar sus nombres en la interfaz ni en el marketing: puede leerse como respaldo que no existe.

1. **Antes (8 a 12 semanas), Sethi:** conversación de alto desempeño ("¿qué tendría que lograr en tres meses para que me consideres de alto desempeño?"), metas acordadas, avances cada 3 o 4 semanas y registro semanal de logros.
2. **En la reunión:** auditoría de acusaciones al abrir, según el estilo del jefe (Voss); maletín con resultados, lo que ganó la empresa y plan de seis meses (Sethi); dato de mercado; cifra precisa, no redonda (Voss); silencio y cierre con fecha.
3. **Objeciones, Voss:** etiqueta ("parece que…", "suena a que…") seguida de pregunta de "qué" o "cómo", nunca "¿por qué?"; espejo de sus últimas palabras; preguntas fáciles de responder con un no; resumen hasta lograr un "eso es"; decir que no sin decir no.
4. **Si ofrecen menos, Voss:** escalera de concesiones decrecientes calculada por el motor (`Engine.numbers().ladder`); antes de bajar, "¿cómo podríamos llegar a mi cifra?"; el último número va con algo que no es plata; nunca partir la diferencia.
5. **Después, Sethi:** correo de cierre; si es un no, "¿qué tendría que pasar para llegar a esa cifra?" con metas, plazo y fecha por escrito; negociar lo que no es sueldo.
6. **Práctica:** simulador con cinco estilos de jefe, incluido uno que dice que no varias veces. La práctica guiada evalúa aporte, cifra, adelantarse a las dudas, etiquetas, preguntas de "qué" y "cómo", fecha, y evita deudas, comparaciones, amenazas y "¿por qué?".

Adaptaciones peruanas que no se tocan: calendario (presupuestos de setiembre a noviembre, evaluaciones de enero a marzo), renovación de contratos a plazo fijo, tú o usted con el jefe, Ley 30709 como pregunta (criterios de la política salarial), y salidas honestas para sector público, construcción civil y recibos por honorarios.

## Pendientes de configuración

- `CONFIG.payUrl` y `CONFIG.whatsapp` vacíos.
- Contexto 2026 en `data/benchmarks/contexto_2026.json` (aumentos proyectados, inflación, UIT, AFP/ONP): revisar cada trimestre.
- Nombre y dominio definitivos ("Pídelo Bien" es provisional).
- RMV: S/ 1,230 desde el 1 de octubre de 2026; segundo tramo a S/ 1,300 en el primer semestre de 2027 por decreto aún no emitido.
