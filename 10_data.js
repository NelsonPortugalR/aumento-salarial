'use strict';
/* ============================================================
   CONFIGURACIÓN — editar antes de lanzar
   ============================================================ */
const CONFIG = {
  brand: 'Pídelo Bien',
  price: 29.90,
  payUrl: '',        // Link de pago (Culqi, Mercado Pago u otro). Vacío = sin botón de pago.
  whatsapp: '',      // WhatsApp para pedir el código, formato 51XXXXXXXXX. Vacío = sin botón.
  rmv: 1230,         // RMV desde el 1 de octubre de 2026 (D.S. 015-2026-TR)
  annualFactor: 15.35, // 12 sueldos + 2 gratificaciones + bonificación extraordinaria + CTS (régimen general)
  capNoPromotion: 0.20, // tope del ancla sin ascenso
  employerFactor: 16.4, // costo anual aprox. para la empresa por cada sol mensual: 12 + 2 grati + bonif. + CTS + EsSalud
  // SHA-256 de códigos de acceso (el código en mayúsculas, sin espacios)
  codeHashes: [
    'c60c1c17b07d992bf3a1d9457eadc28996fbf690c177f204a2803dad7af93386',
    '181c6fa54272c04acf59075021d568b61fda905ba66a6196c849ef342e7274f3',
    '6480870c52daec1a86f9314257b37d7d40cccd620b8e83ca66771a7a38455d6c'
  ]
};

/* ============================================================
   BANDAS PRELIMINARES — reemplazar por datos verificados
   Mediana base (S/ brutos mensuales) para Lima, empresa de 101 a 500
   personas, sector de referencia y 3 a 5 años de experiencia.
   Cuartiles: P25 = 0.80 × mediana, P75 = 1.25 × mediana.
   ============================================================ */
const LEVELS = [
  { id: 'asistente', label: 'Asistente o practicante', base: 1900 },
  { id: 'analista',  label: 'Analista o junior', base: 3300 },
  { id: 'senior',    label: 'Especialista o senior', base: 5200 },
  { id: 'jefe',      label: 'Supervisor, coordinador o jefe', base: 8000 },
  { id: 'gerente',   label: 'Gerente', base: 14000 }
];

const ROLES = [
  { id: 'contabilidad',   label: 'Contabilidad', mult: 0.95 },
  { id: 'datos',          label: 'Datos y BI', mult: 1.15 },
  { id: 'software',       label: 'Desarrollo de software', mult: 1.30 },
  { id: 'soporte',        label: 'Soporte e infraestructura TI', mult: 0.95 },
  { id: 'ing_industrial', label: 'Ingeniería industrial', mult: 1.05 },
  { id: 'ing_civil',      label: 'Ingeniería civil y obras', mult: 1.12 },
  { id: 'ing_minas',      label: 'Ingeniería de minas', mult: 1.25 },
  { id: 'seguridad',      label: 'Seguridad y salud (SSOMA)', mult: 1.05 },
  { id: 'ventas',         label: 'Ventas y comercial', mult: 0.90 },
  { id: 'rrhh',           label: 'Recursos humanos', mult: 0.95 },
  { id: 'logistica',      label: 'Logística y compras', mult: 0.95 },
  { id: 'finanzas',       label: 'Finanzas y tesorería', mult: 1.10 },
  { id: 'administracion', label: 'Administración', mult: 0.95 },
  { id: 'marketing',      label: 'Marketing y comunicación', mult: 0.95 },
  { id: 'enfermeria',     label: 'Enfermería en clínica', mult: 0.95 },
  { id: 'legal',          label: 'Legal', mult: 1.10 },
  { id: 'atencion',       label: 'Atención al cliente', mult: 0.78 },
  { id: 'otro',           label: 'Otro puesto', mult: 1.00 }
];

const SECTORS = [
  { id: 'mineria',      label: 'Minería y energía', mult: 1.25 },
  { id: 'banca',        label: 'Banca, seguros y finanzas', mult: 1.12 },
  { id: 'tecnologia',   label: 'Tecnología y telecomunicaciones', mult: 1.10 },
  { id: 'industria',    label: 'Industria y manufactura', mult: 1.00 },
  { id: 'construccion', label: 'Construcción e inmobiliaria', mult: 1.00 },
  { id: 'servicios',    label: 'Servicios profesionales', mult: 1.00 },
  { id: 'comercio',     label: 'Comercio y retail', mult: 0.92 },
  { id: 'salud',        label: 'Salud privada', mult: 0.95 },
  { id: 'agro',         label: 'Agroindustria y pesca', mult: 0.92 },
  { id: 'educacion',    label: 'Educación privada', mult: 0.85 },
  { id: 'turismo',      label: 'Turismo y restaurantes', mult: 0.85 },
  { id: 'otro',         label: 'Otro sector', mult: 0.95 }
];

const REGIONS = [
  { id: 'lima',       label: 'Lima y Callao', mult: 1.00 },
  { id: 'arequipa',   label: 'Arequipa', mult: 0.90 },
  { id: 'libertad',   label: 'La Libertad', mult: 0.86 },
  { id: 'piura',      label: 'Piura', mult: 0.86 },
  { id: 'lambayeque', label: 'Lambayeque', mult: 0.85 },
  { id: 'cusco',      label: 'Cusco', mult: 0.84 },
  { id: 'ica',        label: 'Ica', mult: 0.88 },
  { id: 'junin',      label: 'Junín', mult: 0.84 },
  { id: 'ancash',     label: 'Áncash', mult: 0.88 },
  { id: 'otra',       label: 'Otra región', mult: 0.82 }
];
const FIELD_MULT = 1.12; // unidad minera, obra o campo

const SIZES = [
  { id: 's1', label: 'De 1 a 10', mult: 0.78 },
  { id: 's2', label: 'De 11 a 100', mult: 0.90 },
  { id: 's3', label: 'De 101 a 500', mult: 1.00 },
  { id: 's4', label: 'Más de 500', mult: 1.10 }
];

const CONTRACTS = [
  { id: 'indefinido', label: 'Indefinido' },
  { id: 'plazo',      label: 'A plazo fijo' },
  { id: 'rxh',        label: 'Recibos por honorarios' },
  { id: 'publico',    label: 'Trabajo en el sector público' },
  { id: 'civil',      label: 'Obrero de construcción civil' }
];

const EXPIRY = [
  { id: 'v1',  label: 'En menos de 1 mes' },
  { id: 'v3',  label: 'En 1 a 3 meses' },
  { id: 'v6',  label: 'En 3 a 6 meses' },
  { id: 'v12', label: 'En más de 6 meses' }
];

const EXPERIENCE = [
  { id: 'e0',  label: 'Menos de 1 año', mult: 0.90 },
  { id: 'e1',  label: 'De 1 a 3 años', mult: 0.96 },
  { id: 'e3',  label: 'De 3 a 5 años', mult: 1.00 },
  { id: 'e5',  label: 'De 5 a 10 años', mult: 1.05 },
  { id: 'e10', label: 'Más de 10 años', mult: 1.08 }
];

const TENURE = [
  { id: 't0', label: 'Menos de 3 meses' },
  { id: 't1', label: 'De 3 a 12 meses' },
  { id: 't2', label: 'De 1 a 2 años' },
  { id: 't3', label: 'Más de 2 años' }
];

const LASTRAISE = [
  { id: 'a6',    label: 'Hace menos de 6 meses' },
  { id: 'a12',   label: 'Hace 6 a 12 meses' },
  { id: 'a24',   label: 'Hace 1 a 2 años' },
  { id: 'a99',   label: 'Hace más de 2 años' },
  { id: 'nunca', label: 'Nunca me han subido' },
  { id: 'no',    label: 'Lo pedí hace poco y me dijeron que no' }
];

const FUNCTIONS = [
  { id: 'personas', label: 'Sí, ahora tengo personas a cargo' },
  { id: 'mas',      label: 'Sí, tengo más responsabilidades' },
  { id: 'no',       label: 'No' }
];

const COMPANY = [
  { id: 'crece',   label: 'Creciendo' },
  { id: 'estable', label: 'Estable' },
  { id: 'recorta', label: 'Recortando gastos o personal' }
];

const APPROVERS = [
  { id: 'jefe',     label: 'Mi jefe directo' },
  { id: 'gerencia', label: 'Gerencia' },
  { id: 'rrhh',     label: 'Recursos Humanos' },
  { id: 'dueno',    label: 'El dueño' }
];

const BOSS_STYLES = [
  { id: 'analitico', label: 'Pide datos', desc: 'analítico: pide datos y números para todo' },
  { id: 'cercano',   label: 'Cuida la relación', desc: 'cercano: valora la relación y suaviza los "no"' },
  { id: 'directo',   label: 'Va al grano', desc: 'directo: va al grano y responde corto' },
  { id: 'evasivo',   label: 'Posterga', desc: 'evasivo: posterga y deriva las decisiones' },
  { id: 'duro',      label: 'Dice que no', desc: 'duro: dice que no varias veces y solo considera algo si el colaborador propone metas concretas con fecha' }
];

const OFFERS = [
  { id: 'no',       label: 'No' },
  { id: 'proceso',  label: 'Estoy en un proceso' },
  { id: 'escrita',  label: 'Sí, por escrito' }
];

const TRATO = [
  { id: 'tu',    label: 'De tú' },
  { id: 'usted', label: 'De usted' }
];

const STEPS = [
  { id: 'puesto', title: '¿Cuál es tu puesto?', type: 'grid', options: ROLES },
  { id: 'nivel', title: '¿En qué nivel estás?', type: 'list', options: LEVELS },
  { id: 'sector', title: '¿En qué sector trabaja tu empresa?', type: 'grid', options: SECTORS },
  { id: 'region', title: '¿Dónde trabajas?', type: 'grid', options: REGIONS },
  { id: 'tamano', title: '¿Cuántas personas trabajan en tu empresa?', type: 'list', options: SIZES },
  { id: 'contrato', title: '¿Cómo es tu contrato?', type: 'list', options: CONTRACTS },
  { id: 'vence', title: '¿Cuándo vence tu contrato?', type: 'list', options: EXPIRY, when: a => a.contrato === 'plazo' },
  { id: 'experiencia', title: '¿Cuánta experiencia tienes en este tipo de puesto?', type: 'list', options: EXPERIENCE },
  { id: 'antiguedad', title: '¿Cuánto tiempo llevas en tu puesto actual?', type: 'list', options: TENURE },
  { id: 'sueldo', title: '¿Cuánto ganas al mes, en bruto?', type: 'salary' },
  { id: 'aumento', title: '¿Cuándo fue tu último aumento?', type: 'list', options: LASTRAISE },
  { id: 'funciones', title: 'En el último año, ¿te sumaron funciones sin ajustar tu sueldo?', type: 'list', options: FUNCTIONS },
  { id: 'empresa', title: '¿Cómo ves a tu empresa este año?', type: 'list', options: COMPANY }
];

const EXIT_ROUTES = ['publico', 'civil', 'rxh'];

const byId = (arr, id) => arr.find(x => x.id === id);
