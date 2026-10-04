# Actualización de los datos

La idea: el modelo se recalcula solo una vez al mes y una persona aprueba los cambios. Nada llega a la página sin revisión.

## Tarea mensual

`.github/workflows/actualizar-datos.yml` corre el día 3 de cada mes (y a mano desde la pestaña Actions):

1. Descarga la ENAHO si cambió el script de descarga (queda en caché) y recalcula todo con `npm run data`.
2. Corre las pruebas del motor, del flujo y de la retroalimentación.
3. Si algo cambió, abre un PR `datos/AAAA-MM` con el resumen de `06_freshness.py`: qué fuentes están vencidas y qué anclas se movieron más de 10%.

Quien revisa mira `data/RESULTADOS.md` (validación contra Buk y Computrabajo) y aprueba o corrige. Las fuentes privadas (guía de reclutamiento, respuestas del test) no viajan al repositorio: se procesan en local y solo se suben sus agregados (`benchmarks/guia_privada_agregada.csv`, `benchmarks/ajustes_propios.json`), que la tarea mensual respeta.

## Calendario

| Cuándo | Qué | Cómo |
| --- | --- | --- |
| Cada mes, día 1 a 3 | Inflación de Lima (INEI) | Editar `inflacion_lima` en `benchmarks/contexto_2026.json` |
| Cada mes | 50 a 100 avisos con sueldo (LinkedIn, Computrabajo, Bumeran), a mano | `benchmarks/avisos/avisos_AAAA-MM.csv` |
| Cada mes, cuando haya backend | Respuestas del test y seguimiento a 30 días | Exportar a `data/private/respuestas/` y `data/private/resultados/`, correr `npm run data:model` |
| Cada trimestre | Prima y tope de AFP (SBS); validación en Computrabajo | `tributos_2026` en el contexto; CSV nuevo de Computrabajo |
| Mayo o junio | ENAHO del año anterior | Código nuevo en `00_download.sh` y `01_enaho_extract.py`, RMV del año en `common.py`, `npm run data` |
| Agosto | Guía Buk y encuesta de aumentos (EY) | Filas en `benchmarks/buk_2026_prensa.csv`; `aumentos_2026` en el contexto |
| Cuando llegue la nueva edición | Guía de reclutamiento privada | Reemplazar `data/private/guia_salarial_privada.xlsx`, `npm run data:guia` |
| Diciembre | UIT del año siguiente | `tributos_2026` en el contexto |
| Cuando salga el decreto | RMV (segundo tramo a S/ 1,300 en 2027) | `CONFIG.rmv` en `10_data.js` y `RMV` en `04_responses.py` |

`benchmarks/fuentes.json` guarda cuándo se actualizó cada fuente; al actualizar una, cambia su fecha `ultima`.

## Comandos

```bash
pip install -r data/requirements.txt
npm run data          # todo: descarga ENAHO, extrae, modela, aplica respuestas y avisos, arma la página
npm run data:model    # sin descargar: modelo, respuestas, avisos, 15_bands.js y la página
npm run data:guia     # tras recibir una edición nueva de la guía privada
npm run data:check    # vigencia de fuentes y cambios en las anclas
npm test && npm run test:data
```
