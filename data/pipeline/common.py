"""Definiciones compartidas del modelo salarial: muestra, clasificaciones y mapeos.

Todo lo que convierte códigos del INEI (CNO 2015, CIIU rev. 4, UBIGEO, tamaño)
en las categorías del test vive aquí, para que sea auditable en un solo lugar.
"""
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work'

# RMV vigente en la mayor parte de cada año de encuesta (S/)
RMV_BY_YEAR = {2022: 1025, 2023: 1025, 2024: 1025, 2025: 1130}

# ---------- Ocupación (CNO 2015) -> tramo ----------
SUPERVISOR_CODES = {4110, 3121, 3122, 3123, 3124, 3125, 3126, 3129, 3131, 3132, 5221, 5222}
PUBLIC_ONLY = set(range(1111, 1116)) | {1171, 1172, 1173} | set(range(3341, 3350))


def tier_of(c):
    if pd.isna(c):
        return None
    c = int(c)
    if c in PUBLIC_ONLY:
        return None
    if c in SUPERVISOR_CODES:
        return 'jefe'
    m = c // 1000
    return {1: 'gerente', 2: 'profesional', 3: 'tecnico', 4: 'apoyo'}.get(m, 'operativo')


# ---------- Ocupación (CNO 2015) -> puesto del test ----------
ROLE_CODES = {
    'contabilidad':   [2411, 3313, 4311, 1211],
    'finanzas':       [2412, 3311, 3312, 4312, 1346],
    'datos':          [2120, 2514, 3315],
    'software':       [2511, 2512, 2513, 2519, 3514, 1330, 3126],
    'soporte':        [2515, 2521, 2529, 3511, 3512, 3513, 2153, 3522],
    'ing_industrial': [2141, 3122, 1321],
    'ing_civil':      [2142, 3112, 3123, 1323, 2161],
    'ing_minas':      [2146, 2114, 3117, 3121, 1322],
    'mantenimiento':  [2144, 2151, 2152, 2149, 3113, 3114, 3115, 3119],
    'seguridad':      [2253, 3257, 2133, 2143],
    'ventas':         [3322, 3321, 3334, 3339, 1221, 5221],
    'rrhh':           [2423, 2424, 4416, 4313, 3333, 1212],
    'logistica':      [4321, 4323, 3124, 3323, 3331, 3125, 1324, 1421, 1134],
    'administracion': [2421, 2422, 3314, 4110, 4419, 4417, 4120, 4131, 4415, 1219, 1213, 2631],
    'marketing':      [2431, 2432, 2166, 2641, 2642, 3432, 1222],
    'enfermeria':     [2221, 3221],
    'salud':          [2211, 2212, 2252, 2254, 2255, 3211, 3212, 3213, 2251, 2259],
    'docencia':       [2311, 2320, 2330, 2341, 2342, 2359],
    'legal':          [2611, 2619, 3411],
    'atencion':       [4222, 4223, 4224, 4225, 4229, 4211, 4214],
}
CODE_TO_ROLE = {c: r for r, cs in ROLE_CODES.items() for c in cs}

# ---------- Actividad (CIIU rev. 4, división) -> sector del test ----------

def sector_of(ciiu):
    if pd.isna(ciiu):
        return 'otro'
    d = int(ciiu) // 100
    if 1 <= d <= 3:
        return 'agro'
    if 5 <= d <= 9 or d == 35:
        return 'mineria'
    if 10 <= d <= 33:
        return 'industria'
    if 41 <= d <= 43 or d == 68:
        return 'construccion'
    if 45 <= d <= 47:
        return 'comercio'
    if 49 <= d <= 53:
        return 'transporte'
    if d in (55, 56, 79):
        return 'turismo'
    if 58 <= d <= 63:
        return 'tecnologia'
    if 64 <= d <= 66:
        return 'banca'
    if 69 <= d <= 75 or 77 <= d <= 82:
        return 'servicios'
    if d == 85:
        return 'educacion'
    if 86 <= d <= 88:
        return 'salud'
    return 'otro'


# ---------- UBIGEO -> región del test ----------
DEPTOS = {
    '01': 'amazonas', '02': 'ancash', '03': 'apurimac', '04': 'arequipa', '05': 'ayacucho',
    '06': 'cajamarca', '07': 'lima', '08': 'cusco', '09': 'huancavelica', '10': 'huanuco',
    '11': 'ica', '12': 'junin', '13': 'libertad', '14': 'lambayeque', '15': 'lima_prov',
    '16': 'loreto', '17': 'madre_de_dios', '18': 'moquegua', '19': 'pasco', '20': 'piura',
    '21': 'puno', '22': 'san_martin', '23': 'tacna', '24': 'tumbes', '25': 'ucayali',
}


def region_of(ubigeo):
    u = str(ubigeo).zfill(6)
    if u[:4] == '1501':
        return 'lima'  # Lima Metropolitana (con Callao, código 07)
    return DEPTOS.get(u[:2], 'otra')


# ---------- Tamaño de empresa ----------

def size_of(p512a, p512b):
    if p512a == 1:
        if pd.notna(p512b) and p512b <= 10:
            return 's1'
        return 's2'
    if p512a in (2, 3):
        return 's2'
    if p512a == 4:
        return 's3'
    if p512a == 5:
        return 's4'
    return None


# ---------- Experiencia en la ocupación ----------

def exp_of(years, months):
    y = (0 if pd.isna(years) else years) + (0 if pd.isna(months) else months) / 12
    if pd.isna(years) and pd.isna(months):
        return None
    if y < 1:
        return 'e0'
    if y < 3:
        return 'e1'
    if y < 5:
        return 'e3'
    if y < 10:
        return 'e5'
    return 'e10'


def educ_of(p301a):
    if pd.isna(p301a):
        return 'sin_dato'
    p = int(p301a)
    if p <= 6:
        return 'secundaria_o_menos'
    if p in (7, 8):
        return 'superior_tecnica'
    if p == 9:
        return 'univ_incompleta'
    if p == 10:
        return 'univ_completa'
    if p == 11:
        return 'posgrado'
    return 'secundaria_o_menos'  # 12: básica especial


def load_sample(white_collar=True):
    """Asalariados formales del sector privado, a tiempo completo, con ingreso válido."""
    df = pd.read_parquet(WORK / 'enaho_asalariados.parquet')
    df = df[df['P510'].isin([5, 6])]                                  # empresa privada o service
    df = df[(df['P419A1'] == 1) | (df['P419A3'] == 1)]                 # seguro de salud pagado por el empleador
    df = df[df['D524A1'] > 0].copy()
    df['ym'] = df['D524A1'] / 12                                       # ingreso bruto mensual (incluye extras, comisiones)
    hours = df['P513T'].where(df['P513T'] > 0, df['P520'])
    df = df[(hours >= 30) & (hours <= 84)]                             # tiempo completo
    rmv = df['ANIO'].map(RMV_BY_YEAR)
    df = df[(df['ym'] >= 0.8 * rmv) & (df['ym'] <= 80000)]
    df['cno'] = df['P505R4'].astype('Int64')
    df['tier'] = df['cno'].map(tier_of)
    df = df[df['tier'].notna()]
    if white_collar:
        df = df[df['tier'].isin(['gerente', 'jefe', 'profesional', 'tecnico', 'apoyo'])]
    df['role'] = df['cno'].map(lambda c: CODE_TO_ROLE.get(int(c), 'otro'))
    df['sector'] = df['P506R4'].map(sector_of)
    df['region'] = df['UBIGEO'].map(region_of)
    df['size'] = [size_of(a, b) for a, b in zip(df['P512A'], df['P512B'])]
    df['exp'] = [exp_of(a, b) for a, b in zip(df['P513A1'], df['P513A2'])]
    df['educ'] = df['P301A'].map(educ_of)
    df['female'] = (df['P207'] == 2).astype(int)
    df['w'] = df['FAC500A'].fillna(df['FAC500A'].median())
    df = df[df['size'].notna() & df['exp'].notna()]
    df['lny'] = np.log(df['ym'])
    return df


def wquantile(values, weights, q):
    v = np.asarray(values, dtype=float)
    w = np.asarray(weights, dtype=float)
    o = np.argsort(v)
    v, w = v[o], w[o]
    cw = np.cumsum(w) - 0.5 * w
    cw /= w.sum()
    return np.interp(q, cw, v)


def predict_p50(bands, rec):
    """Mediana base del modelo para un perfil (misma fórmula que Engine.band, sin la capa propia)."""
    lvl = rec.get('nivel') if rec.get('nivel') in bands['levels'] else 'analista'
    grp = bands['level_group'][lvl]
    role = bands['roles'].get(rec.get('puesto'), bands['roles']['otro'])
    sector = bands['sectors'].get(rec.get('sector'), bands['sectors']['otro'])
    region = bands['regions'].get(rec.get('region'), bands['regions']['otra'])
    v = bands['levels'][lvl]['p50'] * role['mult'] ** bands['role_damping'][lvl] * sector['mult']
    v *= region['mult'][grp] * bands['sizes'][grp].get(rec.get('tamano'), 1.0)
    v *= bands['experience'].get(rec.get('experiencia'), 1.0)
    if str(rec.get('campo')).lower() in ('true', '1'):
        v *= bands['field_mult']
    return v
