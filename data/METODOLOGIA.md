# Metodología de las bandas salariales

Este documento explica de dónde salen la mediana, el P25 y el P75 que el test muestra para cada perfil, qué supuestos hay detrás y cómo se actualizan. Los números que produjo la última corrida están en [`RESULTADOS.md`](RESULTADOS.md), que se genera solo.

## Qué responde la banda

Para un perfil (puesto, nivel, sector, región, tamaño de empresa y años en el puesto), la banda dice cuánto ganan al mes, en bruto, los asalariados formales del sector privado peruano con ese perfil, en soles de octubre de 2026. Incluye comisiones y bonos mensuales, porque así lo declaran las personas en la encuesta. Por eso el test suma el sueldo fijo y el variable promedio antes de comparar.

## Fuentes

| Fuente | Qué aporta | Cómo se usa |
| --- | --- | --- |
| **ENAHO 2022-2025** (INEI), módulos 05 (empleo e ingresos) y 04 (salud) | Sueldo bruto declarado, ocupación (CNO 2015), actividad (CIIU rev. 4), región, tamaño del centro de trabajo, años en la ocupación, educación, sexo y factor de expansión. 10,022 personas en la muestra final. | Estructura completa del modelo: cuánto cambia el sueldo por puesto, sector, región, tamaño y experiencia, y la dispersión dentro de cada perfil. Anclas de los niveles de entrada y profesionales. |
| **Guía Salarial Buk Perú 2026** (planillas de 71,143 personas en 1,149 empresas, enero a junio de 2026) | 28 medianas por cargo publicadas en prensa y en el blog de Buk ([`benchmarks/buk_2026_prensa.csv`](benchmarks/buk_2026_prensa.csv)). | Anclas de jefaturas y gerencias, que casi no aparecen en una encuesta de hogares, y contraste de los demás niveles. |
| **Guía salarial de reclutamiento** (privada, con autorización; 697 filas con cifra, 196 cargos, rangos mínimo, medio y máximo por facturación de la empresa) | Precio de contratación de jefaturas, gerencias y especialistas en empresas medianas y grandes, y el mismo cargo en empresas de distinta facturación. | Anclas de jefe y gerente (35%; senior y coordinador lo heredan del jefe), gradiente de tamaño en empresas grandes y el tramo "Más de 2,000". El archivo original queda en `data/private/` (no se versiona); el repositorio solo guarda celdas de 3 o más cargos por puesto, nivel y tamaño ([`benchmarks/guia_privada_agregada.csv`](benchmarks/guia_privada_agregada.csv)) y el resumen del gradiente de tamaño. |
| **Computrabajo** (páginas públicas de salarios, 4 de octubre de 2026) | Sueldo medio de avisos y reportes para 13 cargos ([`benchmarks/computrabajo_2026-10.csv`](benchmarks/computrabajo_2026-10.csv)). | Solo validación. Se consultó a mano, como lo haría una persona; no se automatizó. |
| **EY Perú, Bumeran, INEI (IPC), BCRP, SBS, MEF** | Aumentos proyectados para 2026, salarios de avisos por seniority, inflación de Lima, ingreso formal promedio, UIT y tasas de AFP y ONP ([`benchmarks/contexto_2026.json`](benchmarks/contexto_2026.json)). | Contexto del kit (lo normal este año, inflación desde el último aumento) y la calculadora de bruto desde neto. |

La guía completa de Buk llega por correo después de un formulario; no se descargó. Si se consigue el PDF, basta con agregar filas al CSV de Buk y volver a correr el modelo.

LinkedIn no se extrae de forma automática: sus condiciones prohíben el scraping. Los avisos con sueldo de LinkedIn (y de otros portales) entran por registro manual, ver "Avisos" más abajo.

## Muestra

De la ENAHO se toman las personas que cumplen todo lo siguiente:

1. Ocupadas, como empleado u obrero (P507 = 3 o 4).
2. En una empresa privada o de servicios (P510 = 5 o 6). Se excluye el sector público.
3. Formales: su seguro de salud (EsSalud o EPS) lo paga el centro de trabajo (P419A1 = 1 o P419A3 = 1). En 2022 y 2023, cuando el INEI publica su indicador de informalidad, esta definición coincide con él en 98% de los casos; se usa la misma regla en los cuatro años para que sean comparables.
4. A tiempo completo: de 30 a 84 horas a la semana (P513T, o P520 si la semana anterior no trabajó).
5. Con ingreso válido: entre 0.8 veces la RMV del año y S/ 80,000. El ingreso es D524A1 / 12, el ingreso total de la ocupación principal anualizado por el INEI y llevado al precio promedio del año.
6. En ocupaciones de oficina, técnicas, profesionales, de jefatura y gerencia (CNO 2015, grupos 1 a 4), que es el público del test. Se excluyen cargos solo públicos.

Los mapeos de códigos del INEI a las categorías del test (puesto, sector, región, tamaño, experiencia) están en un solo archivo: [`pipeline/common.py`](pipeline/common.py).

## Modelo

Regresión lineal ponderada (factor de expansión) del logaritmo del ingreso mensual sobre:

- tramo de la ocupación (gerente, jefe o supervisor, profesional, técnico, apoyo),
- puesto del test (21 grupos de ocupaciones),
- sector (13), región (Lima Metropolitana y 24 departamentos más Lima provincias),
- tamaño de empresa, por separado para cada grupo de nivel (apoyo, profesional, jefatura),
- años en la ocupación (5 tramos), año de la encuesta, educación y sexo como controles.

Educación y sexo se controlan para no confundir los demás efectos, pero no se usan para el perfil: la banda es la misma para una mujer y un hombre, y el test no pregunta educación porque el nivel del puesto ya la recoge.

**Encogimiento.** Cada efecto de puesto, sector y región se combina con el promedio de su grupo según su precisión (Bayes empírico). Un puesto con pocos datos (por ejemplo, Datos y BI, con 7 observaciones) se apoya casi por completo en su grupo (tecnología); uno con muchos datos (Administración, 2,512) usa su propio estimado.

**Normalización.** Puestos y sectores se expresan frente al promedio ponderado del empleo (promedio = 1). Región frente a Lima Metropolitana, tamaño frente a la empresa de 101 a 500 personas y experiencia frente a 3 a 5 años.

**Región según nivel.** La brecha con Lima es mayor para profesionales que para personal de apoyo. Se estima la brecha promedio de provincias por grupo de nivel y se escalan los efectos de cada departamento con esa proporción.

**Empresas grandes.** La ENAHO solo distingue "más de 500" en el centro de trabajo. La guía privada compara el mismo cargo en empresas de distinta facturación: una empresa grande paga 1.37 veces lo que una mediana (118 pares de cargo) y una corporación, 1.27 veces lo que una grande (135 pares). Para "De 501 a 2,000" se combina la ENAHO con ese gradiente (50% en jefaturas, 25% en profesionales, nada en apoyo). "Más de 2,000" suma el salto a corporación: completo en jefaturas, 60% en profesionales y 25% en apoyo.

**Tamaño monótono.** Si la estimación diera que una empresa más grande paga menos (pasa para profesionales en empresas de más de 500, dentro del margen de error), se iguala al tamaño anterior.

## Anclas por nivel

La mediana de la celda de referencia (Lima, 101 a 500 personas, 3 a 5 años, puesto y sector promedio) se fija así:

| Nivel | Regla |
| --- | --- |
| Asistente, auxiliar o técnico | 60% ENAHO (tramos de apoyo y técnico) y 40% Buk, en escala logarítmica |
| Analista o profesional junior | 50% ENAHO (tramo profesional) y 50% Buk |
| Especialista o analista senior | Punto medio entre analista y jefe de área (ya calibrado) |
| Coordinador o supervisor | Punto medio entre los supervisores y jefes administrativos de la ENAHO y el jefe de área (ya calibrado) |
| Jefe de área | Buk (12 jefaturas); luego 35% guía privada |
| Gerente o subgerente | 20% ENAHO y 80% Buk; luego 35% guía privada |

**Guía privada.** Su valor "medio" es el sueldo al que se contrata a alguien de afuera en empresas que usan reclutadoras: en los cargos que coinciden, está entre 1.3 y 1.75 veces la mediana de planilla de Buk. Por eso se divide por 1.2 antes de mezclar (equivale a leerlo como el percentil 65 de los ocupantes, con la dispersión de la ENAHO) y pesa 35%, solo en jefe y gerente; senior y coordinador se calculan después desde el jefe ya calibrado, para no contarla dos veces. Antes de agregar, cada cifra se limpia del efecto de su sector y de la experiencia con los multiplicadores del modelo. Las filas por facturación menor a US$ 30 millones se leen como empresa de 101 a 500 personas; las de US$ 30 a 150 millones, como 501 a 2,000. Las de más de US$ 150 millones no entran al ancla: definen el tramo "Más de 2,000".

Para pasar una cifra de Buk a la celda de referencia se divide por el multiplicador de su puesto y, si es de una industria o tamaño específico, por ese multiplicador. Las cifras "total" de Buk se multiplican por 0.92 (su muestra pesa más en empresas medianas y grandes; Buk reporta que una jefatura de TI gana 14% menos en empresa mediana que en el total) y por 1.02 para llevarlas de enero-junio a octubre.

En jefaturas y gerencias el puesto pesa menos: su multiplicador se eleva a 0.75 (coordinador), 0.5 (jefe) y 0.3 (gerente). En Buk, por ejemplo, las jefaturas de TI no ganan más que las de finanzas, aunque los analistas de TI sí ganan más que los de finanzas.

## Actualización a octubre de 2026

Los efectos de año de la propia ENAHO dan un crecimiento de 4% anual entre 2022 y 2025 para este grupo. De mediados de 2025 a octubre de 2026 se aplica 4% anual (factor 1.05), consistente con el ingreso formal privado del BCRP (+2.7% a +5.2% en 2026) y con los aumentos que proyectan las empresas (5.1% en 82% de ellas, según EY).

## Dispersión (P25 y P75)

Sale de los residuos del modelo: cuánto varía el sueldo entre personas con el mismo perfil. Para profesionales, el P25 es 0.75 veces la mediana y el P75, 1.38 veces. La banda es asimétrica, porque la parte alta se estira más que la baja, y el percentil se calcula con esa asimetría. Ningún P25 baja de la RMV.

## Confianza

Se muestra la menor de tres notas:

- **Puesto:** alta con 150 o más observaciones en la ENAHO, media con 40 a 149, baja con menos o con "Otro puesto".
- **Región:** misma regla.
- **Nivel:** alta para asistente y analista (ENAHO y Buk coinciden); media para los demás (dependen de cifras publicadas de Buk).

Con confianza alta, la brecha frente a la mediana se informa con ±5% de margen; media, ±8%; baja, ±12%.

## Validación

Frente a las medianas publicadas de Buk, la diferencia absoluta mediana es de 8.8% y ya no hay sesgo hacia abajo en jefaturas: business developer pasó de −27% a entre −15% y −26%, las jefaturas de finanzas y contabilidad quedan entre −3% y +8%, y las de TI algo arriba (+7% a +37%). Siguen bajas las jefaturas de marketing (−24%) y cargos especiales como arquitecto de software o gerente de mina. Las jefaturas se anclan en Buk y en la guía privada, así que esa parte de la comparación no es independiente.

Frente a Computrabajo, la diferencia absoluta mediana es de 32%, casi siempre con el modelo arriba: sus cifras salen de avisos, sobre todo de pymes, y de sueldos base sin comisiones. El modelo queda entre ambas fuentes, que es lo esperable para una empresa de 101 a 500 personas.

El índice de avisos de Bumeran (junio de 2026) da S/ 2,365 para junior, S/ 3,535 para semi senior y senior, y S/ 5,569 para supervisor o jefe, en línea con las anclas de asistente a coordinador.

## Qué cambió frente al prototipo

| Factor | Prototipo | Con datos |
| --- | --- | --- |
| Tecnología frente a industria (mismo puesto) | +10% | −9% (la prima de TI está en el puesto, no en el sector) |
| Turismo frente a industria | −15% | +3% |
| Construcción frente a industria | 0% | +8% |
| La Libertad, profesionales | 0.86 | 0.72 |
| Junín, profesionales | 0.84 | 0.75 |
| Empresa de 1 a 10, profesionales | 0.78 | 0.70 |
| Empresa de más de 500, profesionales | 1.10 | 1.06 (501 a 2,000) y 1.22 (más de 2,000) |
| Empresa de más de 2,000, jefaturas | — | 1.45 |
| Más de 10 años en el puesto | 1.08 | 1.20 |
| Ancho de la banda | P25 0.80, P75 1.25 | P25 0.75, P75 1.38 |

Otro hallazgo, que hoy no se usa en el producto: a igual puesto, educación y perfil, las mujeres declaran 12% menos ingreso que los hombres.

## Límites conocidos

- La ENAHO es una encuesta de hogares: el sueldo es declarado y los ingresos altos se subdeclaran. Por eso jefaturas y gerencias se anclan en planillas.
- La ocupación de la ENAHO no distingue analista de analista senior; el nivel del test es autodeclarado.
- El tamaño de la ENAHO es del centro de trabajo, no siempre de toda la empresa.
- Las cifras de Buk son las publicadas en prensa (28 cargos), no la guía completa.
- "Trabajo en unidad minera, obra o campo" suma 10%: es un supuesto sin dato propio.
- Departamentos con menos de 100 observaciones (Huancavelica, Amazonas, Apurímac, Ayacucho, Madre de Dios, Puno) se apoyan sobre todo en el promedio de provincias.

## Retroalimentación con las respuestas del test

Cada test completo, con consentimiento, puede generar un registro anónimo (`Engine.responseRecord`): puesto, nivel, sector, región, tamaño, experiencia, contrato, sueldo, variable, mes, versión del modelo y la recomendación que recibió. No lleva nombre, DNI, empresa ni fecha exacta; el id es aleatorio y solo evita contar dos veces el mismo envío. La app lo envía si `CONFIG.collectUrl` tiene un endpoint; hoy está vacío.

`pipeline/04_responses.py` convierte esos registros en una capa de ajuste:

1. **Filtros:** sueldo bajo 0.9 veces la RMV o sobre S/ 150,000, montos que se ven anuales o en dólares (menos de 0.3 o más de 4 veces la mediana del modelo) y reenvíos.
2. **Sesgo de quien responde:** quien hace el test suele sentirse mal pagado. Ese sesgo se mide como la mediana de las brechas por celda y se descuenta. Las respuestas corrigen la estructura entre celdas (puesto, nivel, Lima o provincias), no el nivel general, que sigue anclado en ENAHO y planillas.
3. **Peso creciente:** el ajuste de una celda pesa n / (n + 30); con 30 respuestas pesa la mitad. Un dato de hace un año pesa la mitad que uno de este mes, y uno verificado con boleta pesa el doble.
4. **Límites:** ninguna celda se publica con menos de 5 respuestas y ningún ajuste mueve la mediana más de ±15%. Con 50 o más respuestas, la confianza de la celda pasa a alta.

La prueba `pipeline/test_responses.py` lo verifica con datos sintéticos: recupera un desvío real de +10% (aplica +8% con 90% de peso), estima el sesgo de quien responde (−10.8% frente a −10% real), respeta el tope y no publica celdas chicas.

**Seguimiento a 30 días.** Un segundo registro (`mes, code, pidio, resultado, aumento_pct, ancla_pct`) mide si la persona pidió y cuánto logró, por recomendación y por tamaño de lo pedido. Ese reporte (`RESPUESTAS.md`) no cambia reglas solo: sirve para revisar a mano el tope del ancla y los umbrales de la recomendación, con un cambio de código revisado, como pide la regla de oro.

## Avisos con sueldo (LinkedIn y otros portales)

Se registran a mano, 50 a 100 al mes, en `benchmarks/avisos/avisos_AAAA-MM.csv` con la plantilla. `pipeline/05_postings.py` normaliza moneda y periodo (un anual se divide entre 14) y calcula el índice "ofrecido / modelo" por nivel y portal en `AVISOS.md`. No entra a la banda, porque un sueldo ofrecido no es un sueldo pagado: es una alarma temprana. Si el índice se mueve más de 10% dos meses seguidos, toca revisar las anclas.

## Cómo actualizar

Calendario, comandos y la tarea mensual automática: [`ACTUALIZACION.md`](ACTUALIZACION.md).
