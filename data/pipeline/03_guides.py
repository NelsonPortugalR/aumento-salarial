"""Guía salarial privada (con autorización): normaliza cargos a puesto, nivel, sector y tamaño del test.

Entrada: data/private/guia_salarial_privada.xlsx (no se versiona).
Salida:  data/benchmarks/guia_privada_agregada.csv (solo agregados por puesto, nivel y tamaño;
         nunca la tabla cargo por cargo).
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT  # noqa: E402

SRC = ROOT / 'private' / 'guia_salarial_privada.xlsx'
OUT = ROOT / 'benchmarks' / 'guia_privada_agregada.csv'


def level_of(cargo):
    c = cargo.lower()
    if re.search(r'\b(chief|ceo|cfo|cto|cio|coo|cmo|cro|chro|ciso|country|director|vp|vicepresident|gerente|subgerente|head|controller corporativo)\b', c):
        return 'gerente'
    if re.search(r'\bmanager\b', c) and not re.search(r'project|key account|brand|product|digital business', c):
        return 'gerente'
    if re.search(r'\b(jefe|superinte|controller|contador general|tesorero|brand manager)', c):
        return 'jefe'
    if re.search(r'\b(supervisor|coordinador|líder|lider|tech lead|team lead)', c):
        return 'supervisor'
    if re.search(r'\b(asistente|auxiliar|técnico|tecnico)\b', c):
        return 'asistente'
    if re.search(r'\banalista\b', c) and not re.search(r'senior|sr\.?\b', c):
        return 'analista'
    return 'senior'  # especialistas, analistas senior, ingenieros, arquitectos, PM, KAM, business partners


KEYWORDS = [
    (r'contab|contador|tribut|impuest|costos', 'contabilidad'),
    (r'tesor|fp&a|finanz|financ|riesgo|crédit|credit|actuar|auditor|inversi|control de gesti|planeamiento financ|\\bcfo\\b|\\bcro\\b|controller|presupuest', 'finanzas'),
    (r'recursos humanos|gestión humana|gestion humana|talento|compensaci|business partner|hrbp|\\bchro\\b|relaciones laborales|cambio|personas', 'rrhh'),
    (r'\\bdata\\b|datos|analyt|analític|\\bbi\\b', 'datos'),
    (r'infraestructura|network|redes|ciberseg|\\bciso\\b|seguridad de la información|soporte|cloud', 'soporte'),
    (r'software|desarroll|devops|arquitect|tech lead|product owner|producto digital|aplicaciones|tecnolog|\\bcto\\b|\\bcio\\b|ingeniero de ia|agile|\\bpmp\\b|project manager|scrum|innovaci', 'software'),
    (r'marketing|marca|brand|trade|digital|comunicaci|\\bcmo\\b', 'marketing'),
    (r'comercial|ventas|venta|key account|\\bkam\\b|\\bbdm\\b|territory|negocios|business development|cuentas|zona|canal|retail manager|sales|medical', 'ventas'),
    (r'mantenimiento|confiabilidad|eléctric|electric|mecánic|mecanic', 'mantenimiento'),
    (r'seguridad|ssoma|salud ocupacional|medio ambiente|ambiental|\\bhse\\b|\\bsso\\b', 'seguridad'),
    (r'mina|geolog|planta concentr|metalurg|exploraci|perforaci|voladura|chancado', 'ing_minas'),
    (r'logíst|logist|compras|abastec|almac|supply|comex|distribuci|transporte|importaci|planificaci|demand', 'logistica'),
    (r'producci|planta|calidad|operaci|excelencia|procesos|packing|manufactura|industrial|mejora continua|\\bcoo\\b|agrícol|agricol', 'ing_industrial'),
    (r'legal|abogad|cumplimiento|compliance', 'legal'),
    (r'gerente general|\\bceo\\b|country manager|administraci|director general', 'administracion'),
    (r'oficina técnica|obra|proyectos de construcci|construcci', 'ing_civil'),
]


def role_of(area, cargo):
    c = cargo.lower()
    for pat, role in KEYWORDS:
        if re.search(pat, c):
            return role
    a = area.lower()
    return {'finanzas': 'finanzas', 'recursos humanos': 'rrhh', 'tecnología': 'software', 'minería': 'ing_minas',
            'ventas y marketing': 'ventas', 'logística y manufactura': 'logistica', 'agroindustria': 'ing_industrial',
            'energía': 'mantenimiento', 'posiciones c-suite': 'administracion'}.get(a, 'otro')


SECTOR_BY_TEXT = [
    (r'minería|mineria', 'mineria'), (r'energ', 'mineria'), (r'agro', 'agro'),
    (r'construcci|inmobiliar|infraestructura', 'construccion'), (r'consumo masivo|consumer|retail|belleza|alimentos', 'comercio'),
    (r'farma|life sciences|healthcare|clínica|clinica', 'salud'), (r'manufactura|industrial|technical goods|envases|químicos|quimicos|metalmec', 'industria'),
    (r'financ|fintech|banca|seguros', 'banca'), (r'tecnolog', 'tecnologia'), (r'operadores logísticos|operadores logisticos', 'transporte'),
    (r'educaci|colegio|universidad', 'educacion'), (r'servicios', 'servicios'),
]


def sector_of(area, ind):
    for txt in (ind, area):
        t = str(txt).lower()
        for pat, s in SECTOR_BY_TEXT:
            if re.search(pat, t):
                return s
    return None


def size_of(crit, seg):
    s = str(seg).lower().replace(' ', '')
    if crit == 'Años de experiencia':
        return 's4', 'corp'  # la guía cubre empresas grandes; sin dato de tamaño
    if 'menosde30' in s or '<30' in s or '31-50' in s or 'pequeña' in s or 'pequeño' in s:
        return 's3', 'mediana'
    if '150' in s and 'más' in s or '>201' in s or '101-200' in s:
        return 's4', 'corp'
    return 's4', 'grande'


def exp_of(crit, seg):
    if crit != 'Años de experiencia':
        return None
    s = str(seg).lower()
    return 'e3' if '3' in s and '5' in s and 'más' not in s and 'a más' not in s and s.strip() != '5 años' else 'e5'


def main():
    df = pd.read_excel(SRC)
    df.columns = ['area', 'ind', 'cargo', 'crit', 'seg', 'mn', 'md', 'mx', 'pag']
    df['md'] = pd.to_numeric(df['md'], errors='coerce')
    df['mn'] = pd.to_numeric(df['mn'], errors='coerce')
    df['mx'] = pd.to_numeric(df['mx'], errors='coerce').replace(0, np.nan)
    df = df[df['md'] > 0].copy()
    df['level'] = df['cargo'].map(level_of)
    df['role'] = [role_of(a, c) for a, c in zip(df['area'], df['cargo'])]
    df['sector'] = [sector_of(a, i) for a, i in zip(df['area'], df['ind'])]
    sz = [size_of(c, s) for c, s in zip(df['crit'], df['seg'])]
    df['size'] = [x[0] for x in sz]
    df['tier'] = [x[1] for x in sz]
    df['exp'] = [exp_of(c, s) for c, s in zip(df['crit'], df['seg'])]
    df['spread_lo'] = df['mn'] / df['md']
    df['spread_hi'] = df['mx'] / df['md']
    df.to_parquet(ROOT / 'work' / 'guia_privada_normalizada.parquet', index=False)

    # Gradiente de tamaño: mismo cargo, área e industria en distinta facturación (solo el resumen se versiona)
    keys = ['area', 'ind', 'cargo', 'exp']
    gp = df[df['crit'] != 'Años de experiencia'].fillna({'exp': '-'}).pivot_table(index=keys, columns='tier', values='md', aggfunc='median')
    def ratio(a, b):
        r = (gp[a] / gp[b]).dropna()
        return round(float(np.exp(np.log(r).median())), 3), int(len(r))
    gm, n1 = ratio('grande', 'mediana')
    cg, n2 = ratio('corp', 'grande')
    (ROOT / 'benchmarks' / 'guia_privada_gradiente.json').write_text(json.dumps(
        {'grande_vs_mediana': gm, 'n1': n1, 'corp_vs_grande': cg, 'n2': n2}, indent=1) + '\n')

    # Anclas: se quita el efecto de sector y experiencia con los multiplicadores vigentes del modelo,
    # y se agregan por puesto, nivel y tamaño. Celdas con menos de 3 cargos pasan a "otro" del mismo nivel.
    bands = json.loads((ROOT / 'bands.json').read_text())
    def norm(r):
        sm = bands['sectors'][r['sector']]['mult'] if isinstance(r['sector'], str) and r['sector'] in bands['sectors'] else 1.0
        em = bands['experience'][r['exp']] if isinstance(r['exp'], str) else bands['experience']['e5']
        return r['md'] / (sm * em)
    base = df[df['tier'].isin(['mediana', 'grande'])].copy()
    base['md_norm'] = base.apply(norm, axis=1)
    cnt = base.groupby(['role', 'level', 'size'])['md'].transform('size')
    base.loc[cnt < 3, 'role'] = 'otro'
    agg = (base.groupby(['role', 'level', 'size'])
               .agg(n_cargos=('md', 'size'), medio_norm=('md_norm', 'median'))
               .reset_index())
    agg = agg[agg['n_cargos'] >= 3]
    agg['medio_norm'] = agg['medio_norm'].round(-2).astype(int)
    agg.to_csv(OUT, index=False)
    print('filas', len(df), '-> celdas agregadas', len(agg))
    print(df.groupby(['level']).agg(n=('md', 'size'), med=('md', 'median')))
    print(df.groupby(['role']).size().sort_values())
    print(df.groupby(['tier']).agg(n=('md', 'size'), med=('md', 'median')))


if __name__ == '__main__':
    main()
