/* ============================================================
   BANDAS DE MERCADO — generado por data/pipeline/export.py
   No editar a mano: corre `npm run data:model` para regenerar.
   ============================================================ */
const MARKET = {
 "version": "2026-10-04",
 "target_month": "2026-10",
 "reference": "Lima Metropolitana, empresa de 101 a 500 personas, 3 a 5 años en el puesto, puesto y sector promedio; sueldo bruto mensual más variable promedio",
 "levels": {
  "asistente": {
   "p50": 2084,
   "lo": 0.794,
   "hi": 1.31,
   "enaho": 2142,
   "enaho_n": 5887,
   "buk": 2000,
   "buk_n": 2,
   "w_enaho": 0.6,
   "guia": null,
   "guia_n": 0,
   "antes_guia": null,
   "metodo": "ENAHO y Buk"
  },
  "analista": {
   "p50": 3581,
   "lo": 0.753,
   "hi": 1.377,
   "enaho": 3799,
   "enaho_n": 2431,
   "buk": 3375,
   "buk_n": 2,
   "w_enaho": 0.5,
   "guia": null,
   "guia_n": 0,
   "antes_guia": null,
   "metodo": "ENAHO y Buk"
  },
  "senior": {
   "p50": 5246,
   "lo": 0.753,
   "hi": 1.377,
   "enaho": null,
   "enaho_n": 2431,
   "buk": 5905,
   "buk_n": 6,
   "w_enaho": null,
   "guia": 7764,
   "guia_n": 21,
   "antes_guia": null,
   "metodo": "punto medio entre analista y jefe de área (con el jefe calibrado por la guía privada)"
  },
  "supervisor": {
   "p50": 4925,
   "lo": 0.738,
   "hi": 1.393,
   "enaho": 3156,
   "enaho_n": 1557,
   "buk": 7169,
   "buk_n": 12,
   "w_enaho": 0.5,
   "guia": null,
   "guia_n": 0,
   "antes_guia": null,
   "metodo": "punto medio entre supervisores (ENAHO) y jefaturas (Buk) (con el jefe calibrado por la guía privada)"
  },
  "jefe": {
   "p50": 7687,
   "lo": 0.738,
   "hi": 1.393,
   "enaho": 3156,
   "enaho_n": 1557,
   "buk": 7169,
   "buk_n": 12,
   "w_enaho": 0.0,
   "guia": 8751,
   "guia_n": 138,
   "antes_guia": 7169,
   "metodo": "Buk + guía privada (35%)"
  },
  "gerente": {
   "p50": 12298,
   "lo": 0.645,
   "hi": 1.488,
   "enaho": 7266,
   "enaho_n": 147,
   "buk": 12714,
   "buk_n": 6,
   "w_enaho": 0.2,
   "guia": 14232,
   "guia_n": 262,
   "antes_guia": 11368,
   "metodo": "ENAHO y Buk + guía privada (35%)"
  }
 },
 "roles": {
  "contabilidad": {
   "mult": 0.967,
   "n": 403,
   "raw": 0.963,
   "w_own": 0.921
  },
  "finanzas": {
   "mult": 1.133,
   "n": 518,
   "raw": 1.151,
   "w_own": 0.877
  },
  "datos": {
   "mult": 1.09,
   "n": 7,
   "raw": 0.683,
   "w_own": 0.146
  },
  "software": {
   "mult": 1.219,
   "n": 195,
   "raw": 1.228,
   "w_own": 0.806
  },
  "soporte": {
   "mult": 1.162,
   "n": 153,
   "raw": 1.157,
   "w_own": 0.768
  },
  "ing_industrial": {
   "mult": 0.928,
   "n": 246,
   "raw": 0.902,
   "w_own": 0.835
  },
  "ing_civil": {
   "mult": 1.242,
   "n": 273,
   "raw": 1.267,
   "w_own": 0.88
  },
  "ing_minas": {
   "mult": 1.065,
   "n": 131,
   "raw": 1.063,
   "w_own": 0.769
  },
  "mantenimiento": {
   "mult": 1.072,
   "n": 735,
   "raw": 1.072,
   "w_own": 0.922
  },
  "seguridad": {
   "mult": 1.009,
   "n": 122,
   "raw": 0.995,
   "w_own": 0.809
  },
  "ventas": {
   "mult": 0.959,
   "n": 680,
   "raw": 0.963,
   "w_own": 0.914
  },
  "rrhh": {
   "mult": 1.004,
   "n": 54,
   "raw": 1.001,
   "w_own": 0.8
  },
  "logistica": {
   "mult": 0.939,
   "n": 1255,
   "raw": 0.934,
   "w_own": 0.934
  },
  "administracion": {
   "mult": 1.062,
   "n": 2512,
   "raw": 1.065,
   "w_own": 0.946
  },
  "marketing": {
   "mult": 0.899,
   "n": 103,
   "raw": 0.894,
   "w_own": 0.805
  },
  "enfermeria": {
   "mult": 0.907,
   "n": 187,
   "raw": 0.91,
   "w_own": 0.842
  },
  "salud": {
   "mult": 0.937,
   "n": 231,
   "raw": 0.944,
   "w_own": 0.87
  },
  "docencia": {
   "mult": 0.846,
   "n": 632,
   "raw": 0.841,
   "w_own": 0.892
  },
  "legal": {
   "mult": 1.063,
   "n": 104,
   "raw": 1.085,
   "w_own": 0.691
  },
  "atencion": {
   "mult": 0.901,
   "n": 571,
   "raw": 0.899,
   "w_own": 0.921
  },
  "otro": {
   "mult": 1.0,
   "n": 910,
   "raw": 0.948,
   "w_own": 1.0
  }
 },
 "role_damping": {
  "asistente": 1.0,
  "analista": 1.0,
  "senior": 1.0,
  "supervisor": 0.75,
  "jefe": 0.5,
  "gerente": 0.3
 },
 "sectors": {
  "servicios": {
   "mult": 0.962,
   "n": 1261,
   "raw": 0.962
  },
  "agro": {
   "mult": 0.972,
   "n": 319,
   "raw": 0.968
  },
  "banca": {
   "mult": 1.074,
   "n": 958,
   "raw": 1.08
  },
  "comercio": {
   "mult": 0.973,
   "n": 1655,
   "raw": 0.972
  },
  "construccion": {
   "mult": 1.102,
   "n": 799,
   "raw": 1.11
  },
  "educacion": {
   "mult": 0.902,
   "n": 1022,
   "raw": 0.892
  },
  "industria": {
   "mult": 1.017,
   "n": 1380,
   "raw": 1.017
  },
  "mineria": {
   "mult": 1.321,
   "n": 538,
   "raw": 1.371
  },
  "otro": {
   "mult": 0.966,
   "n": 345,
   "raw": 0.96
  },
  "salud": {
   "mult": 0.985,
   "n": 464,
   "raw": 0.982
  },
  "tecnologia": {
   "mult": 0.929,
   "n": 426,
   "raw": 0.92
  },
  "transporte": {
   "mult": 0.949,
   "n": 537,
   "raw": 0.945
  },
  "turismo": {
   "mult": 1.046,
   "n": 318,
   "raw": 1.051
  }
 },
 "regions": {
  "lima": {
   "mult": {
    "apoyo": 1.0,
    "profesional": 1.0,
    "direccion": 1.0
   },
   "n": 3682,
   "raw": 1.0
  },
  "amazonas": {
   "mult": {
    "apoyo": 0.865,
    "profesional": 0.762,
    "direccion": 0.802
   },
   "n": 40,
   "raw": 0.787
  },
  "ancash": {
   "mult": {
    "apoyo": 0.896,
    "profesional": 0.814,
    "direccion": 0.846
   },
   "n": 273,
   "raw": 0.88
  },
  "apurimac": {
   "mult": {
    "apoyo": 0.894,
    "profesional": 0.811,
    "direccion": 0.844
   },
   "n": 47,
   "raw": 0.914
  },
  "arequipa": {
   "mult": {
    "apoyo": 0.889,
    "profesional": 0.802,
    "direccion": 0.836
   },
   "n": 708,
   "raw": 0.863
  },
  "ayacucho": {
   "mult": {
    "apoyo": 0.883,
    "profesional": 0.793,
    "direccion": 0.829
   },
   "n": 76,
   "raw": 0.858
  },
  "cajamarca": {
   "mult": {
    "apoyo": 0.896,
    "profesional": 0.814,
    "direccion": 0.847
   },
   "n": 139,
   "raw": 0.89
  },
  "cusco": {
   "mult": {
    "apoyo": 0.878,
    "profesional": 0.783,
    "direccion": 0.821
   },
   "n": 175,
   "raw": 0.844
  },
  "huancavelica": {
   "mult": {
    "apoyo": 0.889,
    "profesional": 0.802,
    "direccion": 0.837
   },
   "n": 37,
   "raw": 0.87
  },
  "huanuco": {
   "mult": {
    "apoyo": 0.885,
    "profesional": 0.796,
    "direccion": 0.831
   },
   "n": 113,
   "raw": 0.869
  },
  "ica": {
   "mult": {
    "apoyo": 0.944,
    "profesional": 0.898,
    "direccion": 0.917
   },
   "n": 685,
   "raw": 0.947
  },
  "junin": {
   "mult": {
    "apoyo": 0.856,
    "profesional": 0.747,
    "direccion": 0.79
   },
   "n": 368,
   "raw": 0.809
  },
  "lambayeque": {
   "mult": {
    "apoyo": 0.868,
    "profesional": 0.767,
    "direccion": 0.807
   },
   "n": 481,
   "raw": 0.832
  },
  "libertad": {
   "mult": {
    "apoyo": 0.837,
    "profesional": 0.716,
    "direccion": 0.763
   },
   "n": 636,
   "raw": 0.787
  },
  "lima_prov": {
   "mult": {
    "apoyo": 0.871,
    "profesional": 0.773,
    "direccion": 0.812
   },
   "n": 347,
   "raw": 0.835
  },
  "loreto": {
   "mult": {
    "apoyo": 0.93,
    "profesional": 0.873,
    "direccion": 0.896
   },
   "n": 203,
   "raw": 0.956
  },
  "madre_de_dios": {
   "mult": {
    "apoyo": 0.923,
    "profesional": 0.86,
    "direccion": 0.885
   },
   "n": 79,
   "raw": 0.974
  },
  "moquegua": {
   "mult": {
    "apoyo": 0.912,
    "profesional": 0.841,
    "direccion": 0.87
   },
   "n": 312,
   "raw": 0.912
  },
  "pasco": {
   "mult": {
    "apoyo": 0.858,
    "profesional": 0.752,
    "direccion": 0.794
   },
   "n": 163,
   "raw": 0.801
  },
  "piura": {
   "mult": {
    "apoyo": 0.893,
    "profesional": 0.809,
    "direccion": 0.842
   },
   "n": 498,
   "raw": 0.87
  },
  "puno": {
   "mult": {
    "apoyo": 0.865,
    "profesional": 0.762,
    "direccion": 0.802
   },
   "n": 89,
   "raw": 0.807
  },
  "san_martin": {
   "mult": {
    "apoyo": 0.912,
    "profesional": 0.842,
    "direccion": 0.87
   },
   "n": 246,
   "raw": 0.913
  },
  "tacna": {
   "mult": {
    "apoyo": 0.865,
    "profesional": 0.763,
    "direccion": 0.804
   },
   "n": 319,
   "raw": 0.821
  },
  "tumbes": {
   "mult": {
    "apoyo": 0.875,
    "profesional": 0.78,
    "direccion": 0.818
   },
   "n": 132,
   "raw": 0.837
  },
  "ucayali": {
   "mult": {
    "apoyo": 0.867,
    "profesional": 0.765,
    "direccion": 0.806
   },
   "n": 174,
   "raw": 0.823
  },
  "otra": {
   "mult": {
    "apoyo": 0.882,
    "profesional": 0.79,
    "direccion": 0.827
   },
   "n": 6340,
   "raw": 0.853
  }
 },
 "sizes": {
  "apoyo": {
   "s3": 1.0,
   "s1": 0.88,
   "s2": 0.98,
   "s4": 1.081,
   "s5": 1.148
  },
  "profesional": {
   "s3": 1.0,
   "s1": 0.704,
   "s2": 0.851,
   "s4": 1.083,
   "s5": 1.251
  },
  "direccion": {
   "s3": 1.0,
   "s1": 0.794,
   "s2": 0.875,
   "s4": 1.197,
   "s5": 1.524
  }
 },
 "experience": {
  "e3": 1.0,
  "e0": 0.876,
  "e1": 0.928,
  "e10": 1.199,
  "e5": 1.072
 },
 "level_group": {
  "asistente": "apoyo",
  "analista": "profesional",
  "senior": "profesional",
  "supervisor": "direccion",
  "jefe": "direccion",
  "gerente": "direccion"
 },
 "field_mult": 1.1,
 "sources": {
  "enaho_n": 10022,
  "years": "2022-2025",
  "buk_cargos": 28,
  "guia_cargos": 421
 },
 "context": {
  "aumentos_2026": {
   "promedio_pct": 5.1,
   "empresas_que_suben_pct": 82,
   "por_nivel_pct": {
    "mandos_medios": 5.4,
    "profesionales": 5.2,
    "ejecutivos": 5.0,
    "asistentes_tecnicos_operarios": 4.9
   },
   "por_sector_pct": {
    "construccion": 6.9,
    "agro": 5.8,
    "consumo_masivo": 5.7
   },
   "historia_pct": {
    "2023": 6.5,
    "2024": 6.3,
    "2025": 5.4,
    "2026": 5.1
   },
   "fuente": "EY Perú, Encuesta de Proyecciones de Incrementos Salariales 2026 (129 empresas), 11 de agosto de 2026",
   "url": "https://energiminas.com/2026/08/11/ey-peru-8-de-cada-10-empresas-preven-aumentar-salarios-en-promedio-51-este-ano/"
  },
  "pedidos": {
   "pidieron_en_2_anios_pct": 36,
   "les_dijeron_que_si_pct": 57,
   "empresas_con_politica_de_revision_pct": 72,
   "empresas_que_ajustan_por_inflacion_pct": 46,
   "fuente": "Guía Salarial Buk Perú 2026 (71,143 trabajadores, 1,149 empresas), vía Gestión, 26 de agosto de 2026",
   "url": "https://gestion.pe/economia/empresas/salarios-en-peru-solo-4-de-cada-10-empresas-ajustan-sueldos-por-inflacion-noticia/"
  },
  "inflacion_lima": {
   "12m_pct": 4.44,
   "12m_mes": "2026-08",
   "24m_pct": 5.6,
   "fuente": "INEI, IPC de Lima Metropolitana: 4.44% a agosto de 2026 y 1.11% a agosto de 2025 (24 meses: 1.0111 × 1.0444)",
   "url": "https://www.peru-retail.com/precios-en-lima-inflacion-anual-acelera-por-tercer-mes-seguido-y-supera-rango-meta-del-bcrp/"
  },
  "avisos_bumeran_jun2026": {
   "junior": 2365,
   "semi_senior_senior": 3535,
   "supervisor_jefe": 5569,
   "fuente": "Índice Bumeran, salario requerido en avisos, junio de 2026",
   "url": "https://www.peru-retail.com/salario-requerido-en-peru-sube-119-estas-son-las-profesiones-con-los-sueldos-mas-altos-en-2026/"
  },
  "ingreso_formal_privado": {
   "promedio_mayo_2026": 3199,
   "var_12m_pct": 2.7,
   "fuente": "BCRP, planilla electrónica (serie PN37696PM), mayo de 2026, vía resúmenes de prensa",
   "url": "https://estadisticas.bcrp.gob.pe/estadisticas/series/mensuales/resultados/PN37696PM/html"
  },
  "tributos_2026": {
   "uit": 5500,
   "deduccion_uit": 7,
   "tramos_quinta": [
    [
     5,
     0.08
    ],
    [
     20,
     0.14
    ],
    [
     35,
     0.17
    ],
    [
     45,
     0.2
    ],
    [
     null,
     0.3
    ]
   ],
   "afp_aporte": 0.1,
   "afp_prima": 0.0137,
   "afp_comision_flujo": 0.0155,
   "afp_tope_prima": 12672.65,
   "onp": 0.13,
   "fuente": "D.S. 301-2025-EF (UIT 2026); Ley del Impuesto a la Renta, art. 53; SBS (aporte 10%, prima 1.37%, comisión sobre flujo 1.47% a 1.69%)",
   "url": "https://elperuano.pe/noticia/285208-mef-establece-en-s-5-500-la-unidad-impositiva-tributaria-para-2026"
  }
 },
 "own": {
  "version": "2026-10-04",
  "n_total": 0,
  "cells": {}
 },
 "offers": {}
};
