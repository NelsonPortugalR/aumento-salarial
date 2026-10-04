'use strict';
/* ============================================================
   CONFIGURACIÓN — editar antes de lanzar
   ============================================================ */
const CONFIG = {
  brand: 'Pídelo Bien',
  price: 29.90,
  payUrl: '',        // Link de pago (Culqi, Mercado Pago u otro). Vacío = sin botón de pago.
  whatsapp: '',      // WhatsApp para pedir el código, formato 51XXXXXXXXX. Vacío = sin botón.
  collectUrl: '',    // Endpoint que recibe el registro anónimo de cada test (POST JSON). Vacío = no se envía nada.
  consentVersion: '2026-10',
  rmv: 1230,         // RMV desde el 1 de octubre de 2026 (D.S. 015-2026-TR)
  annualFactor: 15.35, // 12 sueldos + 2 gratificaciones + bonificación extraordinaria + CTS (régimen general)
  annualFactorSmall: 13.59, // pequeña empresa REMYPE: 12 + media grati dos veces + bonificación + media CTS
  annualFactorMicro: 12,    // microempresa REMYPE: sin gratificación ni CTS
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
   CATÁLOGOS DEL TEST
   Los multiplicadores y las anclas salen de MARKET (15_bands.js),
   generado con datos de la ENAHO y guías salariales 2026.
   ============================================================ */
const LEVELS = [
  { id: 'asistente',  label: 'Asistente, auxiliar o técnico' },
  { id: 'analista',   label: 'Analista o profesional junior' },
  { id: 'senior',     label: 'Especialista o analista senior' },
  { id: 'supervisor', label: 'Coordinador o supervisor' },
  { id: 'jefe',       label: 'Jefe de área' },
  { id: 'gerente',    label: 'Gerente o subgerente' }
];

const ROLES = [
  { id: 'administracion', label: 'Administración' },
  { id: 'contabilidad',   label: 'Contabilidad' },
  { id: 'finanzas',       label: 'Finanzas, créditos y tesorería' },
  { id: 'rrhh',           label: 'Recursos humanos' },
  { id: 'logistica',      label: 'Logística, compras y almacén' },
  { id: 'ventas',         label: 'Ventas y comercial' },
  { id: 'marketing',      label: 'Marketing y comunicación' },
  { id: 'atencion',       label: 'Atención al cliente' },
  { id: 'software',       label: 'Desarrollo de software' },
  { id: 'datos',          label: 'Datos y BI' },
  { id: 'soporte',        label: 'Soporte e infraestructura TI' },
  { id: 'ing_industrial', label: 'Ingeniería industrial y producción' },
  { id: 'mantenimiento',  label: 'Mantenimiento, mecánica y electricidad' },
  { id: 'ing_civil',      label: 'Ingeniería civil, obras y arquitectura' },
  { id: 'ing_minas',      label: 'Minería y geología' },
  { id: 'seguridad',      label: 'Seguridad, salud ocupacional y ambiente' },
  { id: 'legal',          label: 'Legal' },
  { id: 'enfermeria',     label: 'Enfermería' },
  { id: 'salud',          label: 'Medicina, farmacia y tecnología médica' },
  { id: 'docencia',       label: 'Docencia en colegio, instituto o universidad' },
  { id: 'otro',           label: 'Otro puesto' }
];

const SECTORS = [
  { id: 'mineria',      label: 'Minería, petróleo y energía' },
  { id: 'banca',        label: 'Banca, seguros y finanzas' },
  { id: 'tecnologia',   label: 'Tecnología, telecomunicaciones y medios' },
  { id: 'industria',    label: 'Industria y manufactura' },
  { id: 'construccion', label: 'Construcción e inmobiliaria' },
  { id: 'servicios',    label: 'Servicios profesionales y a empresas' },
  { id: 'comercio',     label: 'Comercio y retail' },
  { id: 'transporte',   label: 'Transporte y logística' },
  { id: 'salud',        label: 'Salud privada' },
  { id: 'agro',         label: 'Agroindustria y pesca' },
  { id: 'educacion',    label: 'Educación privada' },
  { id: 'turismo',      label: 'Turismo, hoteles y restaurantes' },
  { id: 'otro',         label: 'Otro sector' }
];

// Las primeras se muestran de entrada; el resto, al tocar "Otra región"
const REGIONS = [
  { id: 'lima',          label: 'Lima Metropolitana y Callao', main: true },
  { id: 'arequipa',      label: 'Arequipa', main: true },
  { id: 'libertad',      label: 'La Libertad', main: true },
  { id: 'piura',         label: 'Piura', main: true },
  { id: 'lambayeque',    label: 'Lambayeque', main: true },
  { id: 'cusco',         label: 'Cusco', main: true },
  { id: 'ica',           label: 'Ica', main: true },
  { id: 'junin',         label: 'Junín', main: true },
  { id: 'ancash',        label: 'Áncash', main: true },
  { id: 'lima_prov',     label: 'Lima provincias' },
  { id: 'amazonas',      label: 'Amazonas' },
  { id: 'apurimac',      label: 'Apurímac' },
  { id: 'ayacucho',      label: 'Ayacucho' },
  { id: 'cajamarca',     label: 'Cajamarca' },
  { id: 'huancavelica',  label: 'Huancavelica' },
  { id: 'huanuco',       label: 'Huánuco' },
  { id: 'loreto',        label: 'Loreto' },
  { id: 'madre_de_dios', label: 'Madre de Dios' },
  { id: 'moquegua',      label: 'Moquegua' },
  { id: 'pasco',         label: 'Pasco' },
  { id: 'puno',          label: 'Puno' },
  { id: 'san_martin',    label: 'San Martín' },
  { id: 'tacna',         label: 'Tacna' },
  { id: 'tumbes',        label: 'Tumbes' },
  { id: 'ucayali',       label: 'Ucayali' }
];

const SIZES = [
  { id: 's1', label: 'De 1 a 10' },
  { id: 's2', label: 'De 11 a 100' },
  { id: 's3', label: 'De 101 a 500' },
  { id: 's4', label: 'De 501 a 2,000' },
  { id: 's5', label: 'Más de 2,000' }
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
  { id: 'e0',  label: 'Menos de 1 año' },
  { id: 'e1',  label: 'De 1 a 3 años' },
  { id: 'e3',  label: 'De 3 a 5 años' },
  { id: 'e5',  label: 'De 5 a 10 años' },
  { id: 'e10', label: 'Más de 10 años' }
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

const RESULTS = [
  { id: 'varios', label: 'Sí, varios' },
  { id: 'alguno', label: 'Uno o dos' },
  { id: 'no',     label: 'Todavía no los tengo medidos' }
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
  { id: 'logros', title: '¿Puedes mostrar resultados de este año con números?', type: 'list', options: RESULTS },
  { id: 'empresa', title: '¿Cómo ves a tu empresa este año?', type: 'list', options: COMPANY }
];

const EXIT_ROUTES = ['publico', 'civil', 'rxh'];

const byId = (arr, id) => arr.find(x => x.id === id);
