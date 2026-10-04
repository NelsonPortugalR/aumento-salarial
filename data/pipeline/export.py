"""Arma 15_bands.js (lo que consume la app) desde bands.json, el contexto y las capas opcionales.

Capas opcionales, si existen:
  benchmarks/ajustes_propios.json   ajustes por celda calculados con respuestas del test (04_responses.py)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
KEYS = ['version', 'target_month', 'reference', 'levels', 'roles', 'role_damping', 'sectors', 'regions',
        'sizes', 'experience', 'level_group', 'field_mult']


def export_js():
    bands = json.loads((ROOT / 'bands.json').read_text())
    payload = {k: bands[k] for k in KEYS}
    src = bands['sources']
    payload['sources'] = {'enaho_n': src['enaho']['n'], 'years': '2022-2025', 'buk_cargos': src['buk']['n_cargos'],
                          'guia_cargos': src.get('guia_privada', {}).get('n_cargos', 0)}
    ctx = json.loads((ROOT / 'benchmarks' / 'contexto_2026.json').read_text())
    ctx.pop('_nota', None)
    payload['context'] = ctx
    own = ROOT / 'benchmarks' / 'ajustes_propios.json'
    payload['own'] = json.loads(own.read_text()) if own.exists() else {'cells': {}, 'n_total': 0}
    offers = ROOT / 'benchmarks' / 'avisos_indice.json'
    payload['offers'] = json.loads(offers.read_text()) if offers.exists() else {}
    (REPO / '15_bands.js').write_text(
        '/* ============================================================\n'
        '   BANDAS DE MERCADO — generado por data/pipeline/export.py\n'
        '   No editar a mano: corre `npm run data:model` para regenerar.\n'
        '   ============================================================ */\n'
        f'const MARKET = {json.dumps(payload, ensure_ascii=False, indent=1)};\n')


if __name__ == '__main__':
    export_js()
