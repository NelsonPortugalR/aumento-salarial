"""Retroalimentación con las respuestas del propio test.

Entrada:  data/private/respuestas/*.csv o *.jsonl, con el registro que arma Engine.responseRecord
          (sin nombre, DNI ni empresa). Columna opcional `verificado` (1 si se validó con boleta).
          data/private/resultados/*.csv (opcional): seguimiento a 30 días
          (mes, code, pidio, resultado, aumento_pct, ancla_pct).
Salida:   data/benchmarks/ajustes_propios.json (factor acotado por celda puesto|nivel|lima/prov)
          data/RESPUESTAS.md (reporte para revisar antes de publicar)

Reglas (CLAUDE.md): una celda gana peso desde ~30 respuestas; con menos de 5 no se publica.
Supuesto: quien hace el test tiende a ganar menos que su mercado (por eso lo hace). Ese sesgo
se estima como la brecha mediana de todas las respuestas y se descuenta: las respuestas corrigen
la estructura entre celdas, no el nivel general, que sigue anclado en ENAHO y planillas.
"""
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, predict_p50, wquantile  # noqa: E402

IN_DIR = ROOT / 'private' / 'respuestas'
OUT_DIR = ROOT / 'private' / 'resultados'
OUT = ROOT / 'benchmarks' / 'ajustes_propios.json'
REPORT = ROOT / 'RESPUESTAS.md'

K_CREDIBILITY = 30      # con 30 respuestas, la celda pesa 50%
MIN_PUBLISH = 5         # celdas con menos respuestas no se publican
MAX_ADJ = 0.15          # ningún ajuste mueve la mediana más de ±15%
HALF_LIFE_MONTHS = 12   # un dato de hace un año pesa la mitad
VERIFIED_WEIGHT = 2.0
RMV = 1230


def load_dir(d):
    frames = []
    for p in sorted(d.glob('*')):
        if p.suffix == '.csv':
            frames.append(pd.read_csv(p))
        elif p.suffix in ('.jsonl', '.ndjson'):
            frames.append(pd.read_json(p, lines=True))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def months_between(mes, today):
    try:
        y, m = map(int, str(mes)[:7].split('-'))
    except ValueError:
        return 0
    return max(0, (today.year - y) * 12 + today.month - m)


def build(df, bands, today=None):
    today = today or date.today()
    stats = {'recibidas': int(len(df))}
    if df.empty:
        return {'version': today.isoformat(), 'n_total': 0, 'cells': {}}, stats, df
    df = df.copy()
    df['total'] = pd.to_numeric(df.get('sueldo'), errors='coerce').fillna(0) + pd.to_numeric(df.get('variable', 0), errors='coerce').fillna(0)
    df = df[(df['total'] >= RMV * 0.9) & (df['total'] <= 150000)]
    if 'id' in df:                                  # id aleatorio por test: evita contar dos veces el mismo envío
        df = df.drop_duplicates(subset=['id'])
    df['base'] = [predict_p50(bands, r) for r in df.to_dict(orient='records')]
    ratio = df['total'] / df['base']
    df = df[(ratio > 0.3) & (ratio < 4)]            # anual, dólares o errores de tipeo
    stats['validas'] = int(len(df))
    if df.empty:
        return {'version': today.isoformat(), 'n_total': 0, 'cells': {}}, stats, df
    df['res'] = np.log(df['total'] / df['base'])
    df['w'] = 0.5 ** (df['mes'].map(lambda m: months_between(m, today)) / HALF_LIFE_MONTHS)
    if 'verificado' in df:
        df.loc[df['verificado'].fillna(0).astype(int) == 1, 'w'] *= VERIFIED_WEIGHT
    df['key'] = df['puesto'].astype(str) + '|' + df['nivel'].astype(str) + '|' + np.where(df['region'] == 'lima', 'lima', 'prov')
    # Sesgo de autoselección: mediana de las medianas por celda (robusta si unas pocas celdas están desviadas)
    cm = df.groupby('key').apply(lambda g: pd.Series({'m': wquantile(g['res'], g['w'], 0.5), 'n': len(g)}), include_groups=False)
    cm = cm[cm['n'] >= MIN_PUBLISH] if (cm['n'] >= MIN_PUBLISH).any() else cm
    bias = float(wquantile(cm['m'], cm['n'], 0.5))
    stats['sesgo_global_pct'] = round(float(np.exp(bias) - 1) * 100, 1)
    cells = {}
    for key, g in df.groupby('key'):
        n = int(len(g))
        if n < MIN_PUBLISH:
            continue
        n_eff = float(g['w'].sum() ** 2 / (g['w'] ** 2).sum())
        z = n_eff / (n_eff + K_CREDIBILITY)
        dev = float(wquantile(g['res'], g['w'], 0.5)) - bias
        adj = float(np.clip(z * dev, -MAX_ADJ, MAX_ADJ))
        cells[key] = {'f': round(float(np.exp(adj)), 3), 'n': n, 'peso': round(z, 2), 'desvio_pct': round(float(np.exp(dev) - 1) * 100, 1)}
    stats['celdas_publicadas'] = len(cells)
    return {'version': today.isoformat(), 'n_total': int(len(df)), 'sesgo_global_pct': stats['sesgo_global_pct'], 'cells': cells}, stats, df


def outcomes_report(out):
    if out.empty:
        return ['Sin seguimientos a 30 días todavía.']
    L = []
    out = out.copy()
    out['exito'] = out['resultado'].isin(['si', 'parcial'])
    pidio = out[out['pidio'] == 'si']
    L.append(f"Seguimientos: {len(out)}. Tuvieron la conversación: {len(pidio)} ({len(pidio) / len(out):.0%}). "
             f"Con resultado favorable o parcial: {pidio['exito'].mean():.0%} de quienes pidieron.")
    L.append('')
    L.append('| Recomendación | Pidieron | Favorable | Aumento mediano |')
    L.append('| --- | ---: | ---: | ---: |')
    for code, g in pidio.groupby('code'):
        L.append(f"| {code} | {len(g)} | {g['exito'].mean():.0%} | {g['aumento_pct'].median():.1f}% |")
    if 'ancla_pct' in pidio:
        pidio = pidio.assign(tramo=pd.cut(pidio['ancla_pct'], [0, 6, 10, 15, 21], labels=['hasta 6%', '6-10%', '10-15%', '15-20%']))
        L.append('')
        L.append('| Cifra pedida | Pidieron | Favorable | Aumento logrado frente a lo pedido |')
        L.append('| --- | ---: | ---: | ---: |')
        for t, g in pidio.groupby('tramo', observed=True):
            L.append(f"| {t} | {len(g)} | {g['exito'].mean():.0%} | {(g['aumento_pct'] / g['ancla_pct']).median():.0%} |")
    L.append('')
    L.append('Estas cifras no cambian reglas solas: sirven para revisar a mano el tope del ancla (20%) y los umbrales de la recomendación.')
    return L


def main():
    bands = json.loads((ROOT / 'bands.json').read_text())
    if not IN_DIR.exists():
        # En CI no hay respuestas privadas: se conserva el ajuste versionado tal cual
        print('Sin data/private/respuestas: se mantiene', OUT.name)
        return
    df = load_dir(IN_DIR)
    adj, stats, used = build(df, bands)
    OUT.write_text(json.dumps(adj, ensure_ascii=False, indent=1) + '\n')
    L = ['# Respuestas propias del test', '', f"Generado por `data/pipeline/04_responses.py` el {adj['version']}.", '']
    L.append(f"Recibidas: {stats['recibidas']}. Válidas: {stats.get('validas', 0)}. Celdas publicadas: {stats.get('celdas_publicadas', 0)}. "
             f"Brecha mediana de quienes responden frente al modelo (sesgo de autoselección, se descuenta): {stats.get('sesgo_global_pct', '—')}%.")
    if adj['cells']:
        L += ['', '| Celda | n | Desvío | Peso | Factor aplicado |', '| --- | ---: | ---: | ---: | ---: |']
        for k, v in sorted(adj['cells'].items(), key=lambda kv: -kv[1]['n']):
            L.append(f"| {k} | {v['n']} | {v['desvio_pct']:+.1f}% | {v['peso']:.2f} | {v['f']:.3f} |")
    L += ['', '## Seguimiento a 30 días', '']
    L += outcomes_report(load_dir(OUT_DIR) if OUT_DIR.exists() else pd.DataFrame())
    REPORT.write_text('\n'.join(L) + '\n')
    print(stats)


if __name__ == '__main__':
    main()
