# Resultados del modelo de bandas

Generado por `data/pipeline/02_model.py` el 2026-10-04. No editar a mano.

Celda de referencia: Lima Metropolitana, empresa de 101 a 500 personas, 3 a 5 años en el puesto, puesto y sector promedio; sueldo bruto mensual más variable promedio. Cifras en soles de 2026-10.

Muestra ENAHO: 10,022 personas. R² del modelo: 0.448. Índice de sueldos por año (2025 = 1): {2025: 1.0, 2022: 0.889, 2023: 0.923, 2024: 0.956}.

## Anclas por nivel (celda de referencia)

| Nivel | Mediana | P25 | P75 | ENAHO | Buk | Método |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Asistente, auxiliar o técnico | 2,084 | 1,655 | 2,730 | 2,142 | 2,000 | ENAHO y Buk |
| Analista o profesional junior | 3,581 | 2,696 | 4,931 | 3,799 | 3,375 | ENAHO y Buk |
| Especialista o analista senior | 5,067 | 3,815 | 6,977 | — | 6,161 | punto medio entre analista y jefe de área |
| Coordinador o supervisor | 4,756 | 3,510 | 6,625 | 3,156 | 7,169 | punto medio entre supervisores (ENAHO) y jefaturas (Buk) |
| Jefe de área | 7,169 | 5,291 | 9,986 | 3,156 | 7,169 | Buk |
| Gerente o subgerente | 11,368 | 7,332 | 16,916 | 7,266 | 12,714 | ENAHO y Buk |

## Multiplicadores por puesto (promedio = 1)

| Puesto | Multiplicador | Estimado propio | Peso propio | n ENAHO |
| --- | ---: | ---: | ---: | ---: |
| ing_civil | 1.242 | 1.267 | 0.88 | 273 |
| software | 1.219 | 1.228 | 0.81 | 195 |
| soporte | 1.162 | 1.157 | 0.77 | 153 |
| finanzas | 1.133 | 1.151 | 0.88 | 518 |
| datos | 1.090 | 0.683 | 0.15 | 7 |
| mantenimiento | 1.072 | 1.072 | 0.92 | 735 |
| ing_minas | 1.065 | 1.063 | 0.77 | 131 |
| legal | 1.063 | 1.085 | 0.69 | 104 |
| administracion | 1.062 | 1.065 | 0.95 | 2,512 |
| seguridad | 1.009 | 0.995 | 0.81 | 122 |
| rrhh | 1.004 | 1.001 | 0.80 | 54 |
| otro | 1.000 | 0.948 | 1.00 | 910 |
| contabilidad | 0.967 | 0.963 | 0.92 | 403 |
| ventas | 0.959 | 0.963 | 0.91 | 680 |
| logistica | 0.939 | 0.934 | 0.93 | 1,255 |
| salud | 0.937 | 0.944 | 0.87 | 231 |
| ing_industrial | 0.928 | 0.902 | 0.83 | 246 |
| enfermeria | 0.907 | 0.910 | 0.84 | 187 |
| atencion | 0.901 | 0.899 | 0.92 | 571 |
| marketing | 0.899 | 0.894 | 0.81 | 103 |
| docencia | 0.846 | 0.841 | 0.89 | 632 |

A nivel de jefatura y gerencia el puesto pesa menos: se eleva a {'asistente': 1.0, 'analista': 1.0, 'senior': 1.0, 'supervisor': 0.75, 'jefe': 0.5, 'gerente': 0.3}.

## Multiplicadores por sector (promedio = 1)

| Sector | Multiplicador | n ENAHO |
| --- | ---: | ---: |
| mineria | 1.321 | 538 |
| construccion | 1.102 | 799 |
| banca | 1.074 | 958 |
| turismo | 1.046 | 318 |
| industria | 1.017 | 1,380 |
| salud | 0.985 | 464 |
| comercio | 0.973 | 1,655 |
| agro | 0.972 | 319 |
| otro | 0.966 | 345 |
| servicios | 0.962 | 1,261 |
| transporte | 0.949 | 537 |
| tecnologia | 0.929 | 426 |
| educacion | 0.902 | 1,022 |

## Multiplicadores por región (Lima Metropolitana = 1)

| Región | Apoyo | Profesional | Jefatura y gerencia | n ENAHO |
| --- | ---: | ---: | ---: | ---: |
| lima | 1.000 | 1.000 | 1.000 | 3,682 |
| ica | 0.944 | 0.898 | 0.917 | 685 |
| loreto | 0.930 | 0.873 | 0.896 | 203 |
| madre_de_dios | 0.923 | 0.860 | 0.885 | 79 |
| san_martin | 0.912 | 0.842 | 0.870 | 246 |
| moquegua | 0.912 | 0.841 | 0.870 | 312 |
| ancash | 0.896 | 0.814 | 0.846 | 273 |
| cajamarca | 0.896 | 0.814 | 0.847 | 139 |
| apurimac | 0.894 | 0.811 | 0.844 | 47 |
| piura | 0.893 | 0.809 | 0.842 | 498 |
| arequipa | 0.889 | 0.802 | 0.836 | 708 |
| huancavelica | 0.889 | 0.802 | 0.837 | 37 |
| huanuco | 0.885 | 0.796 | 0.831 | 113 |
| ayacucho | 0.883 | 0.793 | 0.829 | 76 |
| otra | 0.882 | 0.790 | 0.827 | 6,340 |
| cusco | 0.878 | 0.783 | 0.821 | 175 |
| tumbes | 0.875 | 0.780 | 0.818 | 132 |
| lima_prov | 0.871 | 0.773 | 0.812 | 347 |
| lambayeque | 0.868 | 0.767 | 0.807 | 481 |
| ucayali | 0.867 | 0.765 | 0.806 | 174 |
| tacna | 0.865 | 0.763 | 0.804 | 319 |
| amazonas | 0.865 | 0.762 | 0.802 | 40 |
| puno | 0.865 | 0.762 | 0.802 | 89 |
| pasco | 0.858 | 0.752 | 0.794 | 163 |
| junin | 0.856 | 0.747 | 0.790 | 368 |
| libertad | 0.837 | 0.716 | 0.763 | 636 |

## Tamaño de empresa (101 a 500 = 1)

| Grupo | 1 a 10 | 11 a 100 | 101 a 500 | Más de 500 |
| --- | ---: | ---: | ---: | ---: |
| apoyo | 0.880 | 0.980 | 1.000 | 1.081 |
| profesional | 0.704 | 0.851 | 1.000 | 1.000 |
| direccion | 0.794 | 0.875 | 1.000 | 1.043 |

## Años en el puesto (3 a 5 = 1)

| Menos de 1 | 1 a 3 | 3 a 5 | 5 a 10 | Más de 10 |
| ---: | ---: | ---: | ---: | ---: |
| 0.876 | 0.928 | 1.000 | 1.072 | 1.199 |

## Validación

Diferencia del modelo frente a cifras publicadas. Buk: planillas de 1,149 empresas (medianas y grandes). Computrabajo: avisos y reportes de usuarios, sobre todo pymes; se compara con un perfil país (60% Lima, empresa de 11 a 100).

| Fuente | Cargo | Publicado | Modelo | Diferencia |
| --- | --- | ---: | ---: | ---: |
| Buk 2026 | Gerente de Administración y Finanzas (CFO) | 13,500 | 12,577 | -6.8% |
| Buk 2026 | Gerente de Planeamiento y Presupuesto | 12,030 | 12,577 | +4.5% |
| Buk 2026 | Jefe de Planeamiento y Presupuesto | 8,980 | 8,132 | -9.4% |
| Buk 2026 | Jefe de Control de Gestión | 8,550 | 8,132 | -4.9% |
| Buk 2026 | Jefe de Contabilidad | 7,490 | 7,513 | +0.3% |
| Buk 2026 | Analista Contable | 3,790 | 3,690 | -2.6% |
| Buk 2026 | Analista Financiero | 3,710 | 4,324 | +16.5% |
| Buk 2026 | Asistente Administrativo Financiero | 2,330 | 2,358 | +1.2% |
| Buk 2026 | Técnico de Contabilidad | 2,000 | 2,148 | +7.4% |
| Buk 2026 | Gerente de TIC (CTO) | 15,210 | 12,855 | -15.5% |
| Buk 2026 | Arquitecto de Software | 10,850 | 6,580 | -39.4% |
| Buk 2026 | Jefe de TIC | 8,000 | 8,434 | +5.4% |
| Buk 2026 | Líder de Desarrollo de Software | 8,300 | 8,434 | +1.6% |
| Buk 2026 | Jefe de Inteligencia de Negocios (BI) | 8,000 | 7,976 | -0.3% |
| Buk 2026 | Especialista en Gestión Ágil de Proyectos | 7,290 | 6,580 | -9.7% |
| Buk 2026 | Jefe de Infraestructura Tecnológica | 7,190 | 8,236 | +14.5% |
| Buk 2026 | Líder de Aseguramiento de Calidad (QA) | 6,740 | 6,580 | -2.4% |
| Buk 2026 | Jefe de Sistemas de Información | 6,620 | 8,434 | +27.4% |
| Buk 2026 | Consultor ERP | 6,420 | 6,580 | +2.5% |
| Buk 2026 | Jefatura de TI (empresa mediana) | 6,870 | 7,759 | +12.9% |
| Buk 2026 | Jefatura de TI (industria tecnológica) | 9,030 | 7,206 | -20.2% |
| Buk 2026 | Business Developer (empresa grande) | 6,310 | 4,765 | -24.5% |
| Buk 2026 | Business Developer (industria financiera) | 7,110 | 5,117 | -28.0% |
| Buk 2026 | Gerente de RR.HH. (CHRO) | 14,110 | 12,129 | -14.0% |
| Buk 2026 | Jefe de Desarrollo Organizacional | 10,020 | 7,655 | -23.6% |
| Buk 2026 | Jefe de Marca | 10,260 | 7,245 | -29.4% |
| Buk 2026 | Gerente General | 12,980 | 12,334 | -5.0% |
| Buk 2026 | Gerente de Mina | 20,710 | 12,345 | -40.4% |
| Computrabajo (avisos, oct-2026) | Abogado | 2,253 | 2,968 | +31.7% |
| Computrabajo (avisos, oct-2026) | Analista contable | 2,363 | 2,701 | +14.3% |
| Computrabajo (avisos, oct-2026) | Analista de datos | 2,222 | 3,045 | +37.0% |
| Computrabajo (avisos, oct-2026) | Analista de recursos humanos | 1,945 | 2,804 | +44.2% |
| Computrabajo (avisos, oct-2026) | Analista financiero | 2,640 | 3,165 | +19.9% |
| Computrabajo (avisos, oct-2026) | Asistente administrativo | 1,332 | 2,067 | +55.2% |
| Computrabajo (avisos, oct-2026) | Asistente contable | 1,467 | 1,882 | +28.3% |
| Computrabajo (avisos, oct-2026) | Contador | 2,397 | 2,701 | +12.7% |
| Computrabajo (avisos, oct-2026) | Ejecutivo de ventas | 1,245 | 2,679 | +115.2% |
| Computrabajo (avisos, oct-2026) | Enfermera | 1,913 | 2,534 | +32.5% |
| Computrabajo (avisos, oct-2026) | Ingeniero civil | 3,580 | 3,469 | -3.1% |
| Computrabajo (avisos, oct-2026) | Jefe de logística | 3,078 | 5,657 | +83.8% |
| Computrabajo (avisos, oct-2026) | Supervisor de seguridad | 2,762 | 3,900 | +41.2% |

Diferencia absoluta mediana: Buk 9.6%, Computrabajo 32.5%. Las jefaturas se anclan en Buk, así que su comparación con Buk no es independiente.
