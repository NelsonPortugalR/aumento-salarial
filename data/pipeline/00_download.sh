#!/bin/bash
# Descarga los microdatos oficiales de la ENAHO (INEI): módulo 04 (salud) y 05 (empleo e ingresos).
# Códigos del INEI por año: 2022 = 784, 2023 = 906, 2024 = 966, 2025 = 1031.
# Cuando salga la ENAHO 2026 (hacia mayo de 2027), agrega su código aquí y en common.py / 01_enaho_extract.py.
set -e
DEST="$(cd "$(dirname "$0")/.." && pwd)/raw/enaho"
mkdir -p "$DEST"
cd "$DEST"
for code in 784 906 966 1031; do
  for mod in 04 05; do
    f="$code-Modulo$mod.zip"
    if [ ! -s "$f" ]; then
      echo "Descargando $f"
      curl -sS -f -m 900 -A "Mozilla/5.0" -o "$f" "https://proyectos.inei.gob.pe/iinei/srienaho/descarga/CSV/$f"
    fi
    unzip -oq "$f"
  done
done
echo "Listo: $DEST"
