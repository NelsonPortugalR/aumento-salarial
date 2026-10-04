# Avisos con sueldo: cómo capturarlos y para qué sirven

Herramienta: [Capturador de avisos](https://claude.ai/artifact/Hp4m2S3VrDUUMiy2czqaHX). Es privada; compártela desde su menú Compartir como Colaborador con quien vaya a capturar.

## Reglas para no tener problemas legales

1. Una persona abre el portal como usuario normal, lee el aviso y lo copia. Nada se extrae en automático: Computrabajo lo prohíbe expresamente en su aviso legal, Bumeran prohíbe obtener contenidos por medios no permitidos y LinkedIn prohíbe el scraping.
2. Se guardan solo hechos: cifras, puesto, nivel, región, contrato y el enlace. Nunca el texto completo del aviso ni datos de personas (reclutadores, correos, teléfonos).
3. El producto usa solo agregados: un índice por nivel con 20 o más avisos. Nunca muestra un aviso, una empresa ni un portal como fuente de una cifra individual.
4. Ritmo humano: copiar a mano, sin programas que naveguen o abran avisos solos.

## Rutina

- **Cada semana, media hora:** 15 a 25 avisos con sueldo publicado, empezando por los niveles más lejos de su meta (pestaña Avisos).
- **Cada mes:** "Copiar CSV para el modelo" y guardarlo en `data/benchmarks/avisos/avisos_AAAA-MM.csv`, o pedirle a Claude que lea la base del capturador. Luego `npm run data:model`.
- **Equilibrio:** mezclar portales, regiones y niveles. Si todo viene de Lima o de un solo portal, el índice se sesga.

## Usos de los datos

| Uso | Cómo | Desde cuándo |
| --- | --- | --- |
| Pretensión salarial | El plan B del kit muestra lo que se ofrece hoy para el nivel de la persona | 20 avisos por nivel en 90 días |
| Alerta para recalibrar | Si el índice ofrecido / modelo se mueve más de 10% dos meses seguidos, revisar las anclas | 2 meses de captura |
| Puestos nuevos | Cargos frecuentes en avisos sin buen dato en la ENAHO (por ejemplo, datos y BI) pasan a la lista de puestos a reforzar | 3 meses |
| Contenido y prensa | Índice mensual propio de lo ofrecido por nivel, para LinkedIn, newsletter y medios, citado como agregado de Pídelo Bien | 300 avisos acumulados |
| Futuro: páginas `/sueldos/[cargo]` | Rango ofrecido junto a la banda pagada, para SEO | Cuando una celda tenga 30 avisos |

Lo ofrecido no entra a la banda de lo pagado: un aviso es una oferta, no un sueldo real. Sirve como referencia de mercado y para la pretensión.
