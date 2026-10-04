"""Avisos con sueldo publicado (LinkedIn, Computrabajo, Bumeran u otros), registrados a mano.

Entrada: data/benchmarks/avisos/*.csv con las columnas de PLANTILLA.csv. Una fila por aviso, copiada
         por una persona desde el portal: no se automatiza la extracción (las condiciones de LinkedIn
         prohíben el scraping y las de otros portales deben revisarse antes).
Salida:  data/AVISOS.md: índice "ofrecido / modelo" por nivel y portal. Es un monitor: si el índice
         se mueve más de 10% en dos meses seguidos, hay que revisar las anclas. No entra a la banda,
         porque un sueldo ofrecido no es un sueldo pagado.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, predict_p50  # noqa: E402

DIR = ROOT / 'benchmarks' / 'avisos'
USD_PEN = 3.75   # actualizar con el tipo de cambio del mes
REQUIRED = ['fecha', 'portal', 'url', 'puesto', 'nivel', 'region', 'sueldo_min', 'moneda', 'periodo']


def load():
    frames = [pd.read_csv(p) for p in sorted(DIR.glob('*.csv')) if p.name != 'PLANTILLA.csv']
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=REQUIRED)


def normalize(df, bands):
    df = df.dropna(subset=['sueldo_min']).copy()
    df['sueldo_max'] = df['sueldo_max'].fillna(df['sueldo_min'])
    mid = (pd.to_numeric(df['sueldo_min']) + pd.to_numeric(df['sueldo_max'])) / 2
    mid = np.where(df['moneda'].str.upper() == 'USD', mid * USD_PEN, mid)
    # En Perú un anual suele ser 14 sueldos (12 + 2 gratificaciones)
    mid = np.where(df['periodo'].str.lower().str.startswith('anual'), mid / 14, mid)
    df['mensual'] = mid
    df = df[(df['mensual'] >= 1000) & (df['mensual'] <= 150000)]
    df = df.drop_duplicates(subset=['url'])
    df['modelo'] = [predict_p50(bands, r) for r in df.to_dict(orient='records')]
    df['indice'] = df['mensual'] / df['modelo']
    return df


def main():
    bands = json.loads((ROOT / 'bands.json').read_text())
    raw = load()
    L = ['# Avisos con sueldo publicado', '', 'Generado por `data/pipeline/05_postings.py`. Monitor: no entra a la banda.', '']
    if raw.empty:
        L.append('Todavía no hay avisos registrados. Copia `benchmarks/avisos/PLANTILLA.csv` como `avisos_AAAA-MM.csv` y llénalo a mano.')
    else:
        df = normalize(raw, bands)
        df['mes'] = df['fecha'].astype(str).str[:7]
        L.append(f'Avisos válidos: {len(df)} de {len(raw)}.')
        L += ['', '| Mes | Portal | Nivel | Avisos | Ofrecido / modelo (mediana) |', '| --- | --- | --- | ---: | ---: |']
        for (mes, portal, nivel), g in df.groupby(['mes', 'portal', 'nivel']):
            L.append(f"| {mes} | {portal} | {nivel} | {len(g)} | {g['indice'].median():.2f} |")
    (ROOT / 'AVISOS.md').write_text('\n'.join(L) + '\n')
    print('\n'.join(L[:6]))


if __name__ == '__main__':
    main()
