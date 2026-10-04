"""Extrae de la ENAHO (módulo 500, empleo e ingresos) a los asalariados del sector privado.

Entrada: data/raw/enaho/<código>-Modulo05/Enaho01a-<año>-500.csv (descarga oficial del INEI).
Salida:  data/work/enaho_asalariados.parquet (una fila por persona ocupada asalariada).

No filtra formalidad todavía: guarda las variables para decidirlo en el modelo.
"""
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'raw' / 'enaho'
OUT = ROOT / 'work' / 'enaho_asalariados.parquet'

# Código de encuesta del INEI por año (ENAHO metodología actualizada, anual)
CODES = {2022: 784, 2023: 906, 2024: 966, 2025: 1031}


def module_file(year, module):
    folder = RAW / f'{CODES[year]}-Modulo{module:02d}'
    hits = [p for p in folder.glob('*.csv') if p.name.lower().startswith(f'enaho01a-{year}-{module}00')]
    if len(hits) != 1:
        raise FileNotFoundError(f'No encuentro el módulo {module} de {year} en {folder}. Corre data/pipeline/00_download.sh primero.')
    return hits[0]


COLS = ['MES', 'CONGLOME', 'VIVIENDA', 'HOGAR', 'CODPERSO', 'UBIGEO', 'DOMINIO', 'ESTRATO',
        'P505R4', 'P506R4', 'P507', 'P510', 'P510A1', 'P510B', 'P511A', 'P512A', 'P512B',
        'P513T', 'P513A1', 'P513A2', 'P520', 'P523', 'P524A1', 'P524B1', 'P524C1', 'P524D1', 'P524E1',
        'P5111', 'P5112', 'P5113', 'P558A1', 'P558A2', 'P558A5', 'P207', 'P208A', 'P301A',
        'D524A1', 'I524A1', 'OCU500', 'OCUPINF', 'FAC500A']
HEALTH = ['P4191', 'P4192', 'P4193', 'P419A1', 'P419A2', 'P419A3']
KEYS = ['CONGLOME', 'VIVIENDA', 'HOGAR', 'CODPERSO']


def read_csv(path, cols):
    head = path.open('rb').readline().decode('latin-1')
    sep = ';' if head.count(';') > head.count(',') else ','
    names = [h.strip().strip('"') for h in head.strip().split(sep)]
    use = [c for c in cols if c in names]
    df = pd.read_csv(path, sep=sep, usecols=use, encoding='latin-1', dtype=str, low_memory=False)
    for c in use:
        df[c] = pd.to_numeric(df[c].str.strip().replace({'': None}), errors='coerce')
    return df


def read_year(year):
    df = read_csv(module_file(year, 5), COLS)
    health = read_csv(module_file(year, 4), KEYS + HEALTH).drop_duplicates(KEYS)
    df = df.merge(health, on=KEYS, how='left', validate='one_to_one')
    df['ANIO'] = year
    return df


def main():
    frames = []
    for year in CODES:
        df = read_year(year)
        n_all = len(df)
        # Ocupados (PEA ocupada) que trabajan como empleado (3) u obrero (4)
        df = df[(df['OCU500'] == 1) & (df['P507'].isin([3, 4]))].copy()
        print(year, 'filas', n_all, 'asalariados ocupados', len(df))
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    for c in ['UBIGEO']:
        df[c] = df[c].astype('Int64').astype(str).str.zfill(6)
    df['DEPTO'] = df['UBIGEO'].str[:2]
    df.to_parquet(OUT, index=False)
    print('guardado', OUT, len(df))


if __name__ == '__main__':
    main()
