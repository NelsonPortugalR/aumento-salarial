"""Captura asistida de avisos con sueldo: pegas el texto del aviso y queda una fila lista en el CSV del mes.

Uso (una persona copia el aviso desde el portal; no se extrae nada en automático):
  python3 data/pipeline/capture_posting.py --portal linkedin --url https://... < aviso.txt
  pbpaste | python3 data/pipeline/capture_posting.py --portal bumeran --url https://...
Varios avisos en un archivo: sepáralos con una línea que diga solo ---  (usa --url una vez por aviso con --urls).

Detecta sueldo (rango o monto, S/ o US$), periodo (mensual o anual), cargo, puesto y nivel del test,
región y tipo de contrato. Lo que no detecta queda vacío para completarlo a mano. Revisa antes de guardar con --dry-run.
"""
import argparse
import csv
import importlib
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
guides = importlib.import_module('03_guides')

DIR = Path(__file__).resolve().parents[1] / 'benchmarks' / 'avisos'
FIELDS = ['fecha', 'portal', 'url', 'cargo_publicado', 'puesto', 'nivel', 'region', 'sector', 'tamano',
          'sueldo_min', 'sueldo_max', 'moneda', 'periodo', 'contrato', 'notas']
REGION_WORDS = {
    'lima': r'\blima\b|callao|miraflores|san isidro|surco|la molina|san borja|ate\b|lurín|lurin',
    'arequipa': r'arequipa', 'libertad': r'trujillo|la libertad', 'piura': r'piura|sullana|talara',
    'lambayeque': r'chiclayo|lambayeque', 'cusco': r'cusco|cuzco', 'ica': r'\bica\b|pisco|chincha',
    'junin': r'huancayo|junín|junin', 'ancash': r'chimbote|huaraz|áncash|ancash', 'moquegua': r'moquegua|ilo\b',
    'tacna': r'tacna', 'cajamarca': r'cajamarca', 'puno': r'puno|juliaca', 'loreto': r'iquitos|loreto',
    'ucayali': r'pucallpa|ucayali', 'san_martin': r'tarapoto|moyobamba|san martín', 'pasco': r'cerro de pasco|pasco',
}
NUM = r'(\d{1,3}(?:[.,]\d{3})+|\d{3,6})(?:[.,]\d{2})?'


def to_num(x):
    return int(re.sub(r'[.,]', '', x))


def parse(text):
    t = ' '.join(text.split())
    low = t.lower()
    out = {k: '' for k in FIELDS}
    out['moneda'] = 'USD' if re.search(r'us\$|usd|\$us|dólares|dolares', low) else 'PEN'
    out['periodo'] = 'anual' if re.search(r'anual|al año|por año|/año|brutos anuales', low) else 'mensual'
    money = re.search(rf'(?:s/\.?|us\$|usd|\$)\s*{NUM}(?:\s*(?:-|–|a|hasta)\s*(?:s/\.?|us\$|usd|\$)?\s*{NUM})?', low)
    if not money:
        money = re.search(rf'(?:sueldo|salario|remuneraci[oó]n)[^0-9]{{0,40}}{NUM}(?:\s*(?:-|–|a|hasta)\s*{NUM})?', low)
    if money:
        lo = to_num(money.group(1))
        hi = to_num(money.group(2)) if money.lastindex and money.group(2) else lo
        out['sueldo_min'], out['sueldo_max'] = min(lo, hi), max(lo, hi)
    first = text.strip().splitlines()[0].strip() if text.strip() else ''
    out['cargo_publicado'] = first[:120]
    out['nivel'] = guides.level_of(first) if first else ''
    if re.search(r'\banalista\b', first.lower()) and re.search(r'senior|sr\b', first.lower()):
        out['nivel'] = 'senior'
    if re.search(r'\b(practicante|trainee|pasante)', first.lower()):
        out['nivel'] = 'asistente'
    out['puesto'] = guides.role_of('', first)
    for reg, pat in REGION_WORDS.items():
        if re.search(pat, low):
            out['region'] = reg
            break
    if re.search(r'indeterminad|indefinid|estable', low):
        out['contrato'] = 'indefinido'
    elif re.search(r'plazo fijo|temporal|por proyecto|suplencia', low):
        out['contrato'] = 'plazo'
    elif re.search(r'recibo por honorarios|rxh|locaci[oó]n', low):
        out['contrato'] = 'rxh'
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--portal', required=True, help='linkedin, bumeran, computrabajo, empleosperu u otro')
    ap.add_argument('--url', default='')
    ap.add_argument('--urls', nargs='*', default=None, help='una url por aviso, en orden, si pegas varios')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    blocks = [b for b in re.split(r'^\s*---\s*$', sys.stdin.read(), flags=re.M) if b.strip()]
    urls = args.urls or [args.url] * len(blocks)
    today = date.today().isoformat()
    rows = []
    for b, u in zip(blocks, urls):
        row = parse(b)
        row.update({'fecha': today, 'portal': args.portal, 'url': u})
        rows.append(row)
        flag = '' if row['sueldo_min'] else '  <- sin sueldo: no sirve, revisa'
        print(f"{row['cargo_publicado'][:50]:50s} | {row['puesto']:14s} | {row['nivel']:10s} | {row['region'] or '?':10s} | "
              f"{row['sueldo_min']}-{row['sueldo_max']} {row['moneda']} {row['periodo']}{flag}")
    if args.dry_run:
        return
    DIR.mkdir(parents=True, exist_ok=True)
    path = DIR / f'avisos_{today[:7]}.csv'
    new = not path.exists()
    with path.open('a', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        if new:
            w.writeheader()
        w.writerows([r for r in rows if r['sueldo_min']])
    print(f'Guardado en {path}')


if __name__ == '__main__':
    main()
