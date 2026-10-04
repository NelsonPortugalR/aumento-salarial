"""Chequeo mensual: qué fuentes están vencidas y qué anclas cambiaron mucho frente a la versión publicada.

Uso: python3 data/pipeline/06_freshness.py [--fecha AAAA-MM-DD]
Imprime un resumen en Markdown (lo usa la tarea mensual como cuerpo del PR). Sale con código 0 siempre:
decide una persona.
"""
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRIFT = 0.10


def main():
    today = date.fromisoformat(sys.argv[sys.argv.index('--fecha') + 1]) if '--fecha' in sys.argv else date.today()
    reg = json.loads((ROOT / 'benchmarks' / 'fuentes.json').read_text())['fuentes']
    L = [f'## Vigencia de fuentes al {today.isoformat()}', '', '| Fuente | Última | Estado | Cómo actualizar |', '| --- | --- | --- | --- |']
    for f in reg:
        if f['ultima']:
            age = (today - date.fromisoformat(f['ultima'])).days
            estado = 'vencida' if age > f['cada_dias'] else 'al día'
        else:
            age, estado = None, 'sin datos todavía'
        L.append(f"| {f['nombre']} | {f['ultima'] or '—'} | {estado}{f' ({age} días)' if age is not None else ''} | {f['como']} |")
    new = json.loads((ROOT / 'bands.json').read_text())
    try:
        old = json.loads(subprocess.run(['git', 'show', 'HEAD:data/bands.json'], cwd=ROOT.parent, capture_output=True, text=True, check=True).stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        old = None
    L += ['', '## Cambios en las anclas frente a la versión publicada', '']
    if not old:
        L.append('No hay versión anterior para comparar.')
    else:
        L += ['| Nivel | Antes | Ahora | Cambio |', '| --- | ---: | ---: | ---: |']
        flagged = 0
        for k, v in new['levels'].items():
            before = old['levels'].get(k, {}).get('p50')
            if not before:
                continue
            ch = v['p50'] / before - 1
            flagged += abs(ch) > DRIFT
            L.append(f"| {k} | {before:,} | {v['p50']:,} | {ch:+.1%}{' ⚠' if abs(ch) > DRIFT else ''} |")
        L.append('')
        L.append(f'{flagged} nivel(es) cambian más de {DRIFT:.0%}: revisar data/RESULTADOS.md antes de aprobar.' if flagged else 'Ningún ancla cambia más de 10%.')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
