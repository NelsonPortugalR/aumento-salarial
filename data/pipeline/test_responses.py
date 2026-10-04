"""Prueba con datos sintéticos: el ajuste recupera un desvío real, descuenta el sesgo global y respeta los topes."""
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, predict_p50  # noqa: E402
import importlib
resp = importlib.import_module('04_responses')

rng = np.random.default_rng(7)
bands = json.loads((ROOT / 'bands.json').read_text())
rows = []
def add(n, puesto, nivel, region, shift):
    for _ in range(n):
        r = {'id': f'r{len(rows)}', 'mes': '2026-09', 'puesto': puesto, 'nivel': nivel, 'sector': 'servicios', 'region': region, 'tamano': 's3', 'experiencia': 'e3', 'variable': 0}
        r['sueldo'] = round(predict_p50(bands, r) * np.exp(shift + rng.normal(0, 0.3)))
        rows.append(r)
BIAS = np.log(0.9)                                          # quienes responden ganan 10% menos que su mercado
add(400, 'contabilidad', 'analista', 'lima', BIAS)          # celdas bien calibradas
add(250, 'administracion', 'asistente', 'lima', BIAS)
add(200, 'logistica', 'analista', 'prov', BIAS)
add(150, 'rrhh', 'jefe', 'lima', BIAS)
add(300, 'ventas', 'analista', 'prov', BIAS + np.log(1.10)) # el modelo subestima ventas en provincias 10%
add(120, 'software', 'senior', 'lima', BIAS + np.log(1.60)) # desvío enorme: debe toparse en 15%
add(3, 'legal', 'gerente', 'lima', BIAS)                    # muy pocas: no se publica
df = pd.DataFrame(rows)
df = pd.concat([df, pd.DataFrame([{**rows[0], 'id': 'anual', 'sueldo': 450000}]), pd.DataFrame([rows[1]])])   # monto anual y un reenvío
adj, stats, used = resp.build(df, bands, today=date(2026, 10, 4))
c = adj['cells']
fails = []
if abs(stats['sesgo_global_pct'] - (-10)) > 3: fails.append(f"sesgo global {stats['sesgo_global_pct']}")
if not (0.97 <= c['contabilidad|analista|lima']['f'] <= 1.03): fails.append(f"celda calibrada movida {c['contabilidad|analista|lima']}")
if not (1.05 <= c['ventas|analista|prov']['f'] <= 1.10): fails.append(f"no recupera +10% en ventas {c['ventas|analista|prov']}")
if c['software|senior|lima']['f'] > round(np.exp(0.15), 3): fails.append('no respeta el tope')
if 'legal|gerente|lima' in c: fails.append('publica una celda con menos de 5')
if 'anual' in set(used['id']) or used['id'].duplicated().any(): fails.append('no descartó el monto anual o el reenvío')
if stats['validas'] < len(rows) - 20: fails.append(f"descartó demasiadas respuestas: {stats}")
print('test_responses:', 'OK' if not fails else 'FALLA ' + '; '.join(fails), {k: v['f'] for k, v in c.items()})
sys.exit(1 if fails else 0)
