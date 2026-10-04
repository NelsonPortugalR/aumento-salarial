"""Modelo de bandas salariales para el test.

Estructura (factores) desde la ENAHO 2022-2025: regresión log-lineal ponderada
sobre asalariados formales del sector privado en ocupaciones de oficina,
técnicas, profesionales y de jefatura. Los efectos de puesto, sector y región
se encogen hacia su grupo (Bayes empírico) para no sobreajustar celdas chicas.

Anclas por nivel (celda de referencia: Lima Metropolitana, empresa de 101 a 500
personas, 3 a 5 años en el puesto, puesto y sector promedio): combinación de la
ENAHO y de las medianas publicadas de la Guía Salarial Buk Perú 2026.

Salidas:
  data/bands.json      tabla completa, con fuentes, n y validación
  15_bands.js          módulo que consume la app (generado, no editar a mano)
"""
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_sample, wquantile, ROLE_CODES  # noqa: E402
from export import export_js  # noqa: E402

REPO = ROOT.parent
OUT_JSON = ROOT / 'bands.json'
OUT_JS = REPO / '15_bands.js'
BUK = ROOT / 'benchmarks' / 'buk_2026_prensa.csv'
CT = ROOT / 'benchmarks' / 'computrabajo_2026-10.csv'
CONTEXT = ROOT / 'benchmarks' / 'contexto_2026.json'
GUIDE = ROOT / 'benchmarks' / 'guia_privada_agregada.csv'
GUIDE_GRAD = ROOT / 'benchmarks' / 'guia_privada_gradiente.json'

# ---------- Supuestos explícitos ----------
TARGET = '2026-10'               # mes al que se llevan todas las cifras
GROWTH_2026 = 0.04               # crecimiento nominal anual supuesto desde mediados de 2025
YEARS_FROM_2025 = 1.25           # de mediados de 2025 a octubre de 2026
BUK_AGING = 1.02                 # Buk: planilla enero-junio 2026 -> octubre 2026
BUK_TOTAL_TO_S3 = 0.92           # Buk "total" (empresas medianas y grandes) -> empresa de 101 a 500
FIELD_MULT = 1.10                # unidad minera, obra o campo: supuesto, sin dato en ENAHO
# Peso de la ENAHO frente a Buk en cada ancla (el resto lo pone Buk). La ENAHO capta bien
# los niveles de entrada y profesionales; las jefaturas y gerencias casi no aparecen en una
# encuesta de hogares, así que ahí manda la planilla.
ENAHO_WEIGHT = {'asistente': 0.6, 'analista': 0.5, 'jefe': 0.0, 'gerente': 0.2}
# El área pesa menos a medida que sube el nivel (en Buk, las jefaturas de TI no ganan más que las de finanzas)
ROLE_DAMPING = {'asistente': 1.0, 'analista': 1.0, 'senior': 1.0, 'supervisor': 0.75, 'jefe': 0.5, 'gerente': 0.3}
LEVEL_GROUP = {'asistente': 'apoyo', 'analista': 'profesional', 'senior': 'profesional',
               'supervisor': 'direccion', 'jefe': 'direccion', 'gerente': 'direccion'}
LEVEL_ORDER = ['asistente', 'analista', 'senior', 'supervisor', 'jefe', 'gerente']
# Guía privada de reclutamiento (con autorización). Su "medio" es el precio de contratación en
# empresas que contratan con headhunter: se lleva a mediana de ocupantes dividiendo por 1.2
# (≈ percentil 65 con la dispersión de la ENAHO) y pesa 35% en los niveles donde la ENAHO es débil.
GUIDE_WEIGHT = {'jefe': 0.35, 'gerente': 0.35}
GUIDE_TO_INCUMBENT = 1 / 1.2
# El mismo cargo en empresas de distinta facturación da el gradiente de tamaño en la parte alta.
GUIDE_SIZE_WEIGHT = {'apoyo': 0.0, 'profesional': 0.25, 'direccion': 0.5}   # peso frente a la ENAHO en 500+
CORP_WEIGHT = {'apoyo': 0.25, 'profesional': 0.6, 'direccion': 1.0}        # cuánto del salto "corporación" aplica
TIER_GROUP = {'apoyo': 'apoyo', 'tecnico': 'apoyo', 'profesional': 'profesional', 'jefe': 'direccion', 'gerente': 'direccion'}

ROLE_PARENT = {
    'contabilidad': 'adm', 'finanzas': 'adm', 'administracion': 'adm', 'rrhh': 'adm', 'logistica': 'adm', 'legal': 'adm',
    'software': 'ti', 'soporte': 'ti', 'datos': 'ti',
    'ing_industrial': 'ing', 'ing_civil': 'ing', 'ing_minas': 'ing', 'mantenimiento': 'ing', 'seguridad': 'ing',
    'ventas': 'com', 'marketing': 'com', 'atencion': 'com',
    'enfermeria': 'salud', 'salud': 'salud', 'docencia': 'salud',
}


def eb_shrink(est, se, prior, tau):
    """Bayes empírico: pondera el estimado propio según su precisión frente a la dispersión entre grupos."""
    w = tau ** 2 / (tau ** 2 + se ** 2)
    return w * est + (1 - w) * prior, w


def coefs(model, var, ref):
    out = {ref: (0.0, 0.0)}
    for name, val in model.params.items():
        if name.startswith(f'C({var}') and '[T.' in name:
            key = name.split('[T.')[1].rstrip(']')
            out[key] = (float(val), float(model.bse[name]))
    return out


def main():
    df = load_sample(white_collar=True)
    df['grp'] = df['tier'].map(TIER_GROUP)
    n_total = len(df)
    # Tamaño por grupo de nivel con dummies explícitas (referencia: 101 a 500 en cada grupo)
    size_terms = []
    for g in ['apoyo', 'profesional', 'direccion']:
        for s_ in ['s1', 's2', 's4']:
            col = f'sz_{s_}_{g}'
            df[col] = ((df['size'] == s_) & (df['grp'] == g)).astype(int)
            size_terms.append(col)

    formula = ("lny ~ C(tier, Treatment('profesional')) + C(role, Treatment('otro'))"
               " + C(sector, Treatment('servicios')) + C(region, Treatment('lima'))"
               " + " + " + ".join(size_terms) + " + C(exp, Treatment('e3'))"
               " + C(ANIO, Treatment(2025)) + C(educ, Treatment('univ_completa')) + female")
    m = smf.wls(formula, data=df, weights=df['w']).fit(cov_type='HC1')
    df['res'] = m.resid

    # ---------- Puestos: encogimiento hacia el grupo y normalización ----------
    rc = coefs(m, 'role', 'otro')
    roles_raw = {r: rc[r] for r in ROLE_CODES if r in rc}
    tau_role = float(np.sqrt(max(np.var([v[0] for v in roles_raw.values()]) - np.mean([v[1] ** 2 for v in roles_raw.values()]), 0.004)))
    parents = {}
    for r, (b, se) in roles_raw.items():
        parents.setdefault(ROLE_PARENT[r], []).append((b, se))
    parent_mean = {p: float(np.average([b for b, _ in v], weights=[1 / se ** 2 for _, se in v])) for p, v in parents.items()}
    n_role = df['role'].value_counts().to_dict()
    roles = {}
    for r, (b, se) in roles_raw.items():
        shr, w = eb_shrink(b, se, parent_mean[ROLE_PARENT[r]], tau_role)
        roles[r] = {'b': shr, 'raw': b, 'se': se, 'w_own': w, 'n': int(n_role.get(r, 0))}
    roles['otro'] = {'b': 0.0, 'raw': 0.0, 'se': 0.0, 'w_own': 1.0, 'n': int(n_role.get('otro', 0))}
    wts = df.groupby('role')['w'].sum()
    role_center = float(np.average([roles[r]['b'] for r in wts.index], weights=wts.values))
    for r in roles:
        roles[r]['mult'] = float(np.exp(roles[r]['b'] - role_center))
    roles['otro']['mult'] = 1.0

    # ---------- Sectores ----------
    sc = coefs(m, 'sector', 'servicios')
    tau_sec = float(np.sqrt(max(np.var([v[0] for v in sc.values()]) - np.mean([v[1] ** 2 for v in sc.values()]), 0.002)))
    sec_prior = float(np.average([v[0] for v in sc.values()]))
    sectors = {}
    for s_, (b, se) in sc.items():
        shr, w = eb_shrink(b, se, sec_prior, tau_sec) if se > 0 else (b, 1.0)
        sectors[s_] = {'b': shr, 'raw': b, 'se': se, 'n': int((df['sector'] == s_).sum())}
    swts = df.groupby('sector')['w'].sum()
    sec_center = float(np.average([sectors[s_]['b'] for s_ in swts.index], weights=swts.values))
    for s_ in sectors:
        sectors[s_]['mult'] = float(np.exp(sectors[s_]['b'] - sec_center))

    # ---------- Regiones: encogimiento hacia el promedio de provincias ----------
    gc = coefs(m, 'region', 'lima')
    prov = {k: v for k, v in gc.items() if k != 'lima'}
    pw = df[df['region'] != 'lima'].groupby('region')['w'].sum()
    prov_mean = float(np.average([prov[k][0] for k in pw.index], weights=pw.values))
    tau_reg = float(np.sqrt(max(np.var([v[0] for v in prov.values()]) - np.mean([v[1] ** 2 for v in prov.values()]), 0.001)))
    n_reg = df['region'].value_counts().to_dict()
    regions = {'lima': {'b': 0.0, 'raw': 0.0, 'se': 0.0, 'n': int(n_reg.get('lima', 0))}}
    for k, (b, se) in prov.items():
        shr, w = eb_shrink(b, se, prov_mean, tau_reg)
        regions[k] = {'b': shr, 'raw': b, 'se': se, 'n': int(n_reg.get(k, 0))}

    # Brecha Lima-provincias por grupo de nivel (la región pesa más en profesionales)
    mg = smf.wls(("lny ~ C(tier, Treatment('profesional')) + C(role, Treatment('otro'))"
                  " + C(sector, Treatment('servicios')) + C(size, Treatment('s3'))"
                  " + C(exp, Treatment('e3')) + C(ANIO, Treatment(2025))"
                  " + C(educ, Treatment('univ_completa')) + female + prov:C(grp)"),
                 data=df.assign(prov=(df['region'] != 'lima').astype(int)), weights=df['w']).fit()
    gap_all = prov_mean
    region_scale = {}
    for g in ['apoyo', 'profesional', 'direccion']:
        bg = float(mg.params[f'prov:C(grp)[{g}]'])
        region_scale[g] = bg / gap_all
    # "otra": promedio de provincias, para respuestas guardadas con la lista anterior de regiones
    regions['otra'] = {'b': prov_mean, 'raw': prov_mean, 'se': 0.0, 'n': int((df['region'] != 'lima').sum())}
    for k in regions:
        regions[k]['mult'] = {g: float(np.exp(regions[k]['b'] * region_scale[g])) for g in region_scale}

    # ---------- Tamaño de empresa por grupo de nivel ----------
    sizes = {}
    for g in ['apoyo', 'profesional', 'direccion']:
        sizes[g] = {'s3': 1.0}
        for s_ in ['s1', 's2', 's4']:
            sizes[g][s_] = float(np.exp(m.params[f'sz_{s_}_{g}']))
        # Monotonía: una empresa más grande no paga menos (las diferencias en contra están dentro del error)
        sizes[g]['s2'] = min(max(sizes[g]['s2'], sizes[g]['s1']), 1.0)
        sizes[g]['s4'] = max(sizes[g]['s4'], 1.0)
    sizes_enaho = {g: dict(v) for g, v in sizes.items()}

    # Gradiente de tamaño de la guía privada: mismo cargo, distinta facturación
    guide = pd.read_csv(GUIDE) if GUIDE.exists() else None
    guide_grad = json.loads(GUIDE_GRAD.read_text()) if GUIDE_GRAD.exists() else None
    if guide_grad is not None:
        r_gm, r_cg = guide_grad['grande_vs_mediana'], guide_grad['corp_vs_grande']
        for g in sizes:
            w = GUIDE_SIZE_WEIGHT[g]
            sizes[g]['s4'] = float(np.exp((1 - w) * np.log(sizes[g]['s4']) + w * np.log(r_gm)))
            sizes[g]['s5'] = float(sizes[g]['s4'] * r_cg ** CORP_WEIGHT[g])
    else:
        for g in sizes:
            sizes[g]['s5'] = sizes[g]['s4']

    # ---------- Experiencia en el puesto ----------
    ec = coefs(m, 'exp', 'e3')
    experience = {k: float(np.exp(v[0])) for k, v in ec.items()}

    # ---------- Año y actualización a octubre de 2026 ----------
    yc = coefs(m, 'ANIO', '2025')
    year_index = {int(k): float(np.exp(v[0])) for k, v in yc.items()}
    aging = (1 + GROWTH_2026) ** YEARS_FROM_2025

    # ---------- Dispersión condicional por grupo de nivel ----------
    spread = {}
    for g, sub in df.groupby('grp'):
        qs = [wquantile(sub['res'], sub['w'], q) for q in (0.25, 0.5, 0.75)]
        spread[g] = {'lo': float(np.exp(qs[0] - qs[1])), 'hi': float(np.exp(qs[2] - qs[1])), 'med_res': float(qs[1]), 'n': int(len(sub))}
    sub = df[df['tier'] == 'gerente']
    qs = [wquantile(sub['res'], sub['w'], q) for q in (0.25, 0.5, 0.75)]
    spread_gerente = {'lo': float(np.exp(qs[0] - qs[1])), 'hi': float(np.exp(qs[2] - qs[1])), 'med_res': float(qs[1]), 'n': int(len(sub))}

    # ---------- Anclas ENAHO por nivel en la celda de referencia ----------
    tc = coefs(m, 'tier', 'profesional')
    edc = coefs(m, 'educ', 'univ_completa')
    b_female = float(m.params['female'])
    intercept = float(m.params['Intercept'])

    def tier_anchor(tiers):
        sub = df[df['tier'].isin(tiers)]
        w = sub['w']
        tier_b = float(np.average([tc[t][0] for t in sub['tier']], weights=w))
        educ_b = float(np.average([edc.get(e, (0, 0))[0] for e in sub['educ']], weights=w))
        fem = float(np.average(sub['female'], weights=w))
        grp = TIER_GROUP[tiers[0]]
        log_ref = (intercept + tier_b + educ_b + fem * b_female
                   + role_center                              # puesto promedio
                   + sec_center                               # sector promedio
                   + spread[grp]['med_res'])                  # de media logarítmica a mediana
        return float(np.exp(log_ref) * aging), int(len(sub))

    enaho_anchor = {}
    enaho_anchor['asistente'] = tier_anchor(['apoyo', 'tecnico'])
    enaho_anchor['analista'] = tier_anchor(['profesional'])
    enaho_anchor['jefe'] = tier_anchor(['jefe'])
    enaho_anchor['gerente'] = tier_anchor(['gerente'])

    # ---------- Anclas implícitas de Buk ----------
    buk = pd.read_csv(BUK)
    rows = []
    for _, r in buk.iterrows():
        lvl = r['level']
        g = LEVEL_GROUP[lvl]
        rm = roles[r['role']]['mult'] ** ROLE_DAMPING[lvl]
        adj = BUK_AGING
        if r['ambito'] == 'total':
            adj *= BUK_TOTAL_TO_S3
        elif r['ambito'] == 'grande':
            adj /= sizes[g]['s4']
        elif r['ambito'] in sectors:
            adj /= sectors[r['ambito']]['mult']
        rows.append({'cargo': r['cargo'], 'level': lvl, 'role': r['role'], 'p50': r['p50'], 'ref': r['p50'] * adj / rm})
    bukref = pd.DataFrame(rows)
    buk_anchor = bukref.groupby('level')['ref'].median().to_dict()
    buk_n = bukref.groupby('level').size().to_dict()

    anchors = {}
    for lvl in ['asistente', 'analista', 'jefe', 'gerente']:
        e, n = enaho_anchor[lvl]
        b = buk_anchor.get(lvl)
        w = ENAHO_WEIGHT[lvl] if b else 1.0
        val = float(np.exp(w * np.log(e) + (1 - w) * np.log(b))) if b else e
        anchors[lvl] = {'p50': val, 'enaho': e, 'enaho_n': n, 'buk': b, 'buk_n': int(buk_n.get(lvl, 0)), 'w_enaho': w,
                        'metodo': 'ENAHO y Buk' if 0 < w < 1 else ('Buk' if w == 0 else 'ENAHO')}

    # ---------- Guía privada: anclas implícitas y mezcla en niveles altos ----------
    guide_anchor, guide_n = {}, {}
    if guide is not None:
        gr = []
        for _, r in guide.iterrows():
            lvl = r['level']
            if lvl not in LEVEL_GROUP:
                continue
            g = LEVEL_GROUP[lvl]
            rm = roles.get(r['role'], roles['otro'])['mult'] ** ROLE_DAMPING[lvl]
            # medio_norm ya viene sin efecto de sector ni de experiencia (03_guides.py)
            ref = r['medio_norm'] * GUIDE_TO_INCUMBENT / (rm * sizes[g][r['size']])
            gr.append((lvl, ref, int(r['n_cargos'])))
        gdf = pd.DataFrame(gr, columns=['level', 'ref', 'n'])
        for lvl, sub in gdf.groupby('level'):
            guide_anchor[lvl] = float(wquantile(sub['ref'], sub['n'], 0.5))
            guide_n[lvl] = int(sub['n'].sum())
    def blend_guide(lvl):
        w = GUIDE_WEIGHT.get(lvl)
        if w and lvl in guide_anchor:
            a = anchors[lvl]
            a['antes_guia'] = a['p50']
            a['p50'] = float(np.exp((1 - w) * np.log(a['p50']) + w * np.log(guide_anchor[lvl])))
            a['metodo'] += f' + guía privada ({int(w * 100)}%)'
    # Primero jefe y gerente; los niveles intermedios se calculan desde el jefe ya calibrado
    blend_guide('jefe')
    blend_guide('gerente')
    # Coordinador o supervisor: punto medio (escala logarítmica) entre los supervisores y jefes
    # administrativos de la ENAHO y las jefaturas de área de Buk.
    e_sup, n_sup = enaho_anchor['jefe']
    anchors['supervisor'] = {'p50': float(np.sqrt(e_sup * anchors['jefe']['p50'])), 'enaho': e_sup, 'enaho_n': n_sup,
                             'buk': anchors['jefe']['buk'], 'buk_n': anchors['jefe']['buk_n'], 'w_enaho': 0.5,
                             'metodo': 'punto medio entre supervisores (ENAHO) y jefaturas (Buk)'}
    # Especialista o senior: punto medio entre analista y jefe de área; se contrasta con Buk
    anchors['senior'] = {'p50': float(np.sqrt(anchors['analista']['p50'] * anchors['jefe']['p50'])), 'enaho': None,
                         'enaho_n': anchors['analista']['enaho_n'], 'buk': buk_anchor.get('senior'), 'buk_n': int(buk_n.get('senior', 0)),
                         'w_enaho': None, 'metodo': 'punto medio entre analista y jefe de área'}
    # Senior y coordinador heredan la guía a través del jefe calibrado (no se mezcla dos veces)
    for lvl in ('senior', 'supervisor'):
        if 'jefe' in guide_anchor:
            anchors[lvl]['metodo'] += ' (con el jefe calibrado por la guía privada)'
    anchors = {k: anchors[k] for k in LEVEL_ORDER}
    for lvl in anchors:
        anchors[lvl]['guia'] = guide_anchor.get(lvl)
        anchors[lvl]['guia_n'] = guide_n.get(lvl, 0)

    spread_lvl = {lvl: (spread_gerente if lvl == 'gerente' else spread[LEVEL_GROUP[lvl]]) for lvl in anchors}

    # ---------- Validación contra Buk y Computrabajo ----------
    def predict(level, role, sector=None, region='lima', size='s3', exp_='e3'):
        g = LEVEL_GROUP[level]
        v = anchors[level]['p50'] * roles[role]['mult'] ** ROLE_DAMPING[level]
        v *= sectors[sector]['mult'] if sector else 1.0
        v *= regions[region]['mult'][g] * sizes[g][size] * experience[exp_]
        return v

    val_rows = []
    for _, r in buk.iterrows():
        size = {'mediana': 's3', 'grande': 's4'}.get(r['ambito'], 's3')
        sector = r['ambito'] if r['ambito'] in sectors else None
        p = predict(r['level'], r['role'], sector=sector, size=size)
        if r['ambito'] == 'total':
            p /= BUK_TOTAL_TO_S3
        val_rows.append({'fuente': 'Buk 2026', 'cargo': r['cargo'], 'publicado': int(r['p50']), 'modelo': round(p / BUK_AGING), 'dif_pct': round((p / BUK_AGING / r['p50'] - 1) * 100, 1)})
    ct_map = {
        'analista-contable': ('analista', 'contabilidad'), 'contador': ('analista', 'contabilidad'),
        'asistente-contable': ('asistente', 'contabilidad'), 'analista-financiero': ('analista', 'finanzas'),
        'analista-de-datos': ('analista', 'datos'), 'ingeniero-civil': ('analista', 'ing_civil'),
        'ejecutivo-de-ventas': ('analista', 'ventas'), 'analista-de-recursos-humanos': ('analista', 'rrhh'),
        'asistente-administrativo': ('asistente', 'administracion'), 'abogado': ('analista', 'legal'),
        'enfermera': ('analista', 'enfermeria'), 'supervisor-de-seguridad': ('supervisor', 'seguridad'),
        'jefe-de-logistica': ('jefe', 'logistica'),
    }
    if CT.exists():
        ct = pd.read_csv(CT).dropna(subset=['media_mensual'])
        # Computrabajo: avisos y reportes de todo el país, sobre todo pymes. Se compara con
        # el perfil "país": promedio de regiones (60% Lima) y empresa de 11 a 100.
        for _, r in ct.iterrows():
            if r['slug'] not in ct_map:
                continue
            lvl, role = ct_map[r['slug']]
            g = LEVEL_GROUP[lvl]
            p = predict(lvl, role, size='s2') * (0.6 + 0.4 * float(np.exp(prov_mean * region_scale[g])))
            val_rows.append({'fuente': 'Computrabajo (avisos, oct-2026)', 'cargo': r['puesto'], 'publicado': int(r['media_mensual']), 'modelo': round(p), 'dif_pct': round((p / r['media_mensual'] - 1) * 100, 1)})
    validation = pd.DataFrame(val_rows)

    # ---------- Salida ----------
    def r3(x):
        return round(float(x), 3)

    bands = {
        'version': f'{date.today().isoformat()}',
        'target_month': TARGET,
        'reference': 'Lima Metropolitana, empresa de 101 a 500 personas, 3 a 5 años en el puesto, puesto y sector promedio; sueldo bruto mensual más variable promedio',
        'sources': {
            'enaho': {'name': 'INEI, Encuesta Nacional de Hogares 2022-2025, módulo de empleo e ingresos', 'n': n_total,
                      'filter': 'asalariados del sector privado con seguro de salud pagado por el empleador, 30 a 84 horas semanales, ocupaciones de oficina, técnicas, profesionales, de jefatura y gerencia (CNO 2015, grupos 1 a 4)'},
            'buk': {'name': 'Guía Salarial Buk Perú 2026 (cifras publicadas en prensa y en el blog de Buk)', 'n_cargos': int(len(buk))},
            'computrabajo': {'name': 'Computrabajo, páginas públicas de salarios (consulta del 4 de octubre de 2026)', 'uso': 'solo validación'},
            'guia_privada': {'name': 'Guía salarial de reclutamiento (privada, con autorización; solo agregados)', 'n_cargos': int(guide['n_cargos'].sum()) if guide is not None else 0,
                             'gradiente_tamano': guide_grad},
        },
        'assumptions': {
            'growth_2026': GROWTH_2026, 'aging_from_2025': r3(aging), 'buk_aging': BUK_AGING,
            'buk_total_to_s3': BUK_TOTAL_TO_S3, 'field_mult': FIELD_MULT, 'enaho_weight': ENAHO_WEIGHT,
            'role_damping': ROLE_DAMPING, 'guide_weight': GUIDE_WEIGHT, 'guide_to_incumbent': r3(GUIDE_TO_INCUMBENT),
            'guide_size_weight': GUIDE_SIZE_WEIGHT, 'corp_weight': CORP_WEIGHT,
        },
        'model': {'r2': r3(m.rsquared), 'n': int(m.nobs), 'tau_role': r3(tau_role), 'tau_region': r3(tau_reg), 'tau_sector': r3(tau_sec),
                  'year_index': {k: r3(v) for k, v in year_index.items()}, 'female_gap': r3(np.exp(b_female))},
        'levels': {k: {'p50': round(v['p50']), 'lo': r3(spread_lvl[k]['lo']), 'hi': r3(spread_lvl[k]['hi']),
                       'enaho': round(v['enaho']) if v['enaho'] else None, 'enaho_n': v['enaho_n'],
                       'buk': round(v['buk']) if v['buk'] else None, 'buk_n': v['buk_n'], 'w_enaho': v['w_enaho'],
                       'guia': round(v['guia']) if v.get('guia') else None, 'guia_n': v.get('guia_n', 0),
                       'antes_guia': round(v['antes_guia']) if v.get('antes_guia') else None,
                       'metodo': v['metodo']}
                   for k, v in anchors.items()},
        'roles': {k: {'mult': r3(v['mult']), 'n': v['n'], 'raw': r3(np.exp(v['raw'] - role_center)), 'w_own': r3(v['w_own'])} for k, v in roles.items()},
        'role_damping': ROLE_DAMPING,
        'sectors': {k: {'mult': r3(v['mult']), 'n': v['n'], 'raw': r3(np.exp(v['raw'] - sec_center))} for k, v in sectors.items()},
        'regions': {k: {'mult': {g: r3(x) for g, x in v['mult'].items()}, 'n': v['n'], 'raw': r3(np.exp(v['raw']))} for k, v in regions.items()},
        'sizes': {g: {k: r3(x) for k, x in v.items()} for g, v in sizes.items()},
        'sizes_enaho': {g: {k: r3(x) for k, x in v.items()} for g, v in sizes_enaho.items()},
        'experience': {k: r3(v) for k, v in experience.items()},
        'level_group': LEVEL_GROUP,
        'field_mult': FIELD_MULT,
        'validation': validation.to_dict(orient='records'),
    }
    OUT_JSON.write_text(json.dumps(bands, ensure_ascii=False, indent=2) + '\n')
    write_report(bands, validation)

    export_js()

    # ---------- Resumen en consola ----------
    pd.set_option('display.width', 200)
    print('n', n_total, 'R2', r3(m.rsquared), 'aging', r3(aging), 'year index', year_index)
    print('anchors'); print(pd.DataFrame(bands['levels']).T)
    print('roles'); print(pd.DataFrame(bands['roles']).T.sort_values('mult'))
    print('sectors'); print(pd.DataFrame(bands['sectors']).T.sort_values('mult'))
    print('sizes'); print(pd.DataFrame(sizes))
    print('region scale', region_scale)
    print('regions'); print(pd.DataFrame({k: {**v['mult'], 'n': v['n']} for k, v in bands['regions'].items()}).T.sort_values('profesional'))
    print('experience', bands['experience'])
    print('spread', spread)
    print('buk refs'); print(bukref.round(0).to_string())
    print('validation'); print(validation.to_string())
    print('abs dif median: Buk', validation[validation.fuente.str.startswith('Buk')].dif_pct.abs().median(),
          '| Computrabajo', validation[validation.fuente.str.startswith('Comp')].dif_pct.abs().median())


LABELS = {
    'levels': {'asistente': 'Asistente, auxiliar o técnico', 'analista': 'Analista o profesional junior', 'senior': 'Especialista o analista senior',
               'supervisor': 'Coordinador o supervisor', 'jefe': 'Jefe de área', 'gerente': 'Gerente o subgerente'},
}


def write_report(bands, validation):
    """Reporte legible de lo que produjo el modelo (se regenera con cada corrida)."""
    L = []
    L.append('# Resultados del modelo de bandas')
    L.append('')
    L.append(f"Generado por `data/pipeline/02_model.py` el {bands['version']}. No editar a mano.")
    L.append('')
    L.append(f"Celda de referencia: {bands['reference']}. Cifras en soles de {bands['target_month']}.")
    L.append('')
    L.append(f"Muestra ENAHO: {bands['sources']['enaho']['n']:,} personas. R² del modelo: {bands['model']['r2']}. "
             f"Índice de sueldos por año (2025 = 1): {bands['model']['year_index']}.")
    L.append('')
    L.append('## Anclas por nivel (celda de referencia)')
    L.append('')
    L.append('| Nivel | Mediana | P25 | P75 | ENAHO | Buk | Guía privada (÷1.2) | Antes de la guía | Método |')
    L.append('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |')
    f = lambda x: format(round(x), ',') if x else '—'
    for k, v in bands['levels'].items():
        p50 = v['p50']
        L.append(f"| {LABELS['levels'][k]} | {p50:,} | {round(p50 * v['lo']):,} | {round(p50 * v['hi']):,} | "
                 f"{f(v['enaho'])} | {f(v['buk'])} | {f(v.get('guia'))} | {f(v.get('antes_guia'))} | {v['metodo']} |")
    L.append('')
    L.append('## Multiplicadores por puesto (promedio = 1)')
    L.append('')
    L.append('| Puesto | Multiplicador | Estimado propio | Peso propio | n ENAHO |')
    L.append('| --- | ---: | ---: | ---: | ---: |')
    for k, v in sorted(bands['roles'].items(), key=lambda kv: -kv[1]['mult']):
        L.append(f"| {k} | {v['mult']:.3f} | {v['raw']:.3f} | {v['w_own']:.2f} | {v['n']:,} |")
    L.append('')
    L.append(f"A nivel de jefatura y gerencia el puesto pesa menos: se eleva a {bands['role_damping']}.")
    L.append('')
    L.append('## Multiplicadores por sector (promedio = 1)')
    L.append('')
    L.append('| Sector | Multiplicador | n ENAHO |')
    L.append('| --- | ---: | ---: |')
    for k, v in sorted(bands['sectors'].items(), key=lambda kv: -kv[1]['mult']):
        L.append(f"| {k} | {v['mult']:.3f} | {v['n']:,} |")
    L.append('')
    L.append('## Multiplicadores por región (Lima Metropolitana = 1)')
    L.append('')
    L.append('| Región | Apoyo | Profesional | Jefatura y gerencia | n ENAHO |')
    L.append('| --- | ---: | ---: | ---: | ---: |')
    for k, v in sorted(bands['regions'].items(), key=lambda kv: -kv[1]['mult']['profesional']):
        m = v['mult']
        L.append(f"| {k} | {m['apoyo']:.3f} | {m['profesional']:.3f} | {m['direccion']:.3f} | {v['n']:,} |")
    L.append('')
    L.append('## Tamaño de empresa (101 a 500 = 1)')
    L.append('')
    L.append('| Grupo | 1 a 10 | 11 a 100 | 101 a 500 | 501 a 2,000 | Más de 2,000 | 500+ solo ENAHO |')
    L.append('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
    for g, v in bands['sizes'].items():
        L.append(f"| {g} | {v['s1']:.3f} | {v['s2']:.3f} | {v['s3']:.3f} | {v['s4']:.3f} | {v['s5']:.3f} | {bands['sizes_enaho'][g]['s4']:.3f} |")
    gg = bands['sources']['guia_privada'].get('gradiente_tamano')
    if gg:
        L.append('')
        L.append(f"Gradiente de la guía privada (mismo cargo): empresa grande / mediana = {gg['grande_vs_mediana']:.2f} ({gg['n1']} pares); "
                 f"corporación / grande = {gg['corp_vs_grande']:.2f} ({gg['n2']} pares).")
    L.append('')
    L.append('## Años en el puesto (3 a 5 = 1)')
    L.append('')
    e = bands['experience']
    L.append('| Menos de 1 | 1 a 3 | 3 a 5 | 5 a 10 | Más de 10 |')
    L.append('| ---: | ---: | ---: | ---: | ---: |')
    L.append(f"| {e['e0']:.3f} | {e['e1']:.3f} | {e['e3']:.3f} | {e['e5']:.3f} | {e['e10']:.3f} |")
    L.append('')
    L.append('## Validación')
    L.append('')
    L.append('Diferencia del modelo frente a cifras publicadas. Buk: planillas de 1,149 empresas (medianas y grandes). '
             'Computrabajo: avisos y reportes de usuarios, sobre todo pymes; se compara con un perfil país (60% Lima, empresa de 11 a 100).')
    L.append('')
    L.append('| Fuente | Cargo | Publicado | Modelo | Diferencia |')
    L.append('| --- | --- | ---: | ---: | ---: |')
    for _, r in validation.iterrows():
        L.append(f"| {r['fuente']} | {r['cargo']} | {int(r['publicado']):,} | {int(r['modelo']):,} | {r['dif_pct']:+.1f}% |")
    buk = validation[validation['fuente'].str.startswith('Buk')]['dif_pct'].abs().median()
    ct = validation[validation['fuente'].str.startswith('Comp')]['dif_pct'].abs().median()
    L.append('')
    L.append(f"Diferencia absoluta mediana: Buk {buk:.1f}%, Computrabajo {ct:.1f}%. Las jefaturas se anclan en Buk, así que su "
             'comparación con Buk no es independiente.')
    (ROOT / 'RESULTADOS.md').write_text('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
