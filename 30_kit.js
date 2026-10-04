/* ============================================================
   KIT — plantillas determinísticas (funcionan sin IA)
   ============================================================ */
const Kit = (() => {
  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const money = n => 'S/\u00A0' + Math.round(n).toLocaleString('en-US');
  const clean = s => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
  const lowerFirst = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

  // Doble alternativa: dos días hábiles, desde pasado mañana
  function dayPair(now) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + 2);
    const out = [];
    while (out.length < 2) {
      const w = d.getDay();
      if (w !== 0 && w !== 6) out.push(DAYS[w]);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function monthPair(now) {
    const m = now.getMonth();
    if (m >= 8) return ['enero', 'febrero'];
    return [MONTHS[(m + 2) % 12], MONTHS[(m + 3) % 12]];
  }

  const RAISE_CODES = ['pide_ahora', 'pide_pronto', 'construye', 'merito', 'trato', 'paquete', 'esperar', 'mercado'];
  const BUILD_CODES = ['construye', 'trato', 'metas', 'esperar'];   // primero metas y evidencia, luego la reunión
  const SHORT_DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  const workday = d => { const x = new Date(d.getTime()); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); return x; };
  const fmt = d => `${SHORT_DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;

  // Cronograma con fechas reales: primero la evidencia, luego la reunión y siempre el cierre por escrito
  function timeline(code, now, tight) {
    if (tight) {
      return [
        [workday(now), 'Arma tu maletín: logro, impacto y valor en soles.'],
        [workday(addDays(now, 1)), 'Pide la reunión con el mensaje del kit. Tiene que ocurrir antes de firmar la renovación.'],
        [workday(addDays(now, 4)), 'Reunión: speech, cifra y silencio.'],
        [workday(addDays(now, 4)), 'El mismo día, envía el correo de cierre.']
      ];
    }
    if (BUILD_CODES.includes(code)) {
      return [
        [workday(addDays(now, 2)), 'Conversación de alto desempeño: acuerda dos o tres metas medibles con tu jefe.'],
        [workday(addDays(now, 3)), 'Empieza tu registro semanal de logros: qué problema había, qué hiciste y qué resultado logró.'],
        [workday(addDays(now, 25)), 'Primer reporte de avance en dos líneas, con números.'],
        [workday(addDays(now, 46)), 'Segundo reporte de avance.'],
        [workday(addDays(now, 52)), 'Cierra tu maletín y revisa tus cifras con el kit.'],
        [workday(addDays(now, 56)), 'Pide la reunión de sueldo con el mensaje del kit.']
      ];
    }
    return [
      [workday(now), 'Arma tu maletín: cinco a ocho logros con su impacto y su valor en soles.'],
      [workday(addDays(now, 2)), 'Revisa tu banda y tus tres cifras. Practica el speech en voz alta, mejor con alguien de confianza.'],
      [workday(addDays(now, 3)), 'Pide la reunión con el mensaje del kit, con una semana de anticipación.'],
      [workday(addDays(now, 9)), 'Un día antes, envía tu resumen de una página.'],
      [workday(addDays(now, 10)), 'Reunión: speech, cifra concreta y silencio.'],
      [workday(addDays(now, 10)), 'El mismo día, envía el correo de cierre con lo acordado.'],
      [workday(addDays(now, 40)), 'Si quedó pendiente, retoma en la fecha acordada.']
    ];
  }

  function build(a, r, n, k, now = new Date()) {
    const T = (tu, usted) => (k.trato === 'usted' ? usted : tu);
    const [d1, d2] = dayPair(now);
    const [m1, m2] = monthPair(now);
    const jefe = clean(k.jefe);
    const role = byId(ROLES, a.puesto) || byId(ROLES, 'otro');
    const level = byId(LEVELS, a.nivel) || LEVELS[1];
    const tenure = byId(TENURE, a.antiguedad);
    const raise = RAISE_CODES.includes(r.code) && n.anchor;
    const resp = clean(k.responsabilidades) || (a.funciones === 'personas'
      ? 'ahora tengo personas a cargo'
      : a.funciones === 'mas' ? 'asumí responsabilidades que antes no tenía' : 'aporto más de lo que se esperaba cuando se fijó mi sueldo');
    const logro1 = clean(k.logro1) || '[tu logro principal, con un número]';
    const logro2 = clean(k.logro2) || '[un segundo logro, también con un número]';
    const alt = r.code === 'paquete' ? 'un bono por resultados' : 'una capacitación o certificación pagada por la empresa';
    const plan = clean(k.plan) || '[lo que quieres lograr en los próximos seis meses]';
    const impacto = clean(k.impacto) || '[qué ganó la empresa: ahorro, ventas, tiempo o errores evitados]';
    const reviewMonth = MONTHS[(now.getMonth() + 3) % 12];
    const tight = a.contrato === 'plazo' && (a.vence === 'v1' || a.vence === 'v3');
    const kit = { generatedAt: now.toISOString(), raise: !!raise, code: r.code, trato: k.trato === 'usted' ? 'usted' : 'tu', reviewMonth };
    kit.timeline = timeline(r.code, now, tight).map(([d, t]) => ({ fecha: fmt(d), paso: t }));

    // Antes de la reunión: metas acordadas, registro de logros y avances
    kit.prep = {
      timing: tight
        ? 'Tu contrato vence pronto: haz esta conversación esta misma semana, en versión corta, y pide la reunión de sueldo antes de la renovación.'
        : (BUILD_CODES.includes(r.code)
          ? 'Empieza esta semana. Ahí se gana el aumento: llegas a la reunión con metas acordadas y cumplidas, y tu jefe ya sabe que vas a pedir.'
          : 'Ya tienes caso para pedir. Esta conversación es opcional: úsala si quieres llegar con metas acordadas, o ve directo a la reunión.'),
      ask: `${jefe ? 'Hola, ' + jefe + '.' : 'Hola.'} ¿${T('Tienes', 'Tiene')} 15 minutos esta semana para conversar sobre mi desarrollo? ¿El ${d1} o el ${d2}?`,
      script: tight
        ? `Quiero crecer aquí y aportar más. ¿Qué es lo que más ${T('valoras', 'valora')} de mi trabajo y qué tendría que reforzar para ser de alto desempeño? Mi contrato se renueva pronto y me gustaría que la renovación refleje lo que aporto. ¿Podemos conversarlo antes de firmar?`
        : `Quiero crecer aquí y aportar más. ¿Qué tendría que lograr en los próximos tres meses para que ${T('me consideres', 'me considere')} de alto desempeño? Me gustaría que lo definamos con dos o tres metas concretas. Y si las cumplo, me gustaría conversar sobre mi crecimiento y mi remuneración en ${reviewMonth}. ¿${T('Te', 'Le')} parece?`,
      checkin: `Cada tres o cuatro semanas, un mensaje corto: "Así voy con lo que acordamos: [tu avance, con número]. ¿Algo que ${T('quieras', 'quiera')} que ajuste?"`,
      log: 'Lleva un registro semanal de logros con tres partes: qué problema había, qué hiciste y qué resultado logró, con número. En dos meses tendrás tu maletín casi listo.',
      research: [
        '¿En qué mes se arma el presupuesto del próximo año? Pide antes de que se cierre.',
        '¿Quién aprueba los aumentos y qué necesita para defender el tuyo?',
        '¿Hay una banda o criterios para tu puesto? Tu empresa debe informarte su política salarial (Ley 30709); pregúntalo como curiosidad, no como reclamo.'
      ]
    };

    // Cifras
    kit.numbers = { anchor: n.anchor, target: n.target, floor: n.floor, annual: n.annual, band: r.band, pretFrom: n.pretFrom, pretTo: n.pretTo, pctAnchor: n.pctAnchor, pctTarget: n.pctTarget };
    const ctx = (typeof MARKET !== 'undefined' && MARKET.context) || {};
    const pct = x => String(x).replace('.', ',') + '%';
    if (raise && ctx.aumentos_2026) {
      const avg = ctx.aumentos_2026.promedio_pct;
      kit.raiseContext = n.pctAnchor <= avg + 0.5
        ? `Lo que pides es ${pct(n.pctAnchor)} más, en línea con lo que las empresas en Perú proyectan subir este año: ${pct(avg)} en promedio (EY, 2026).`
        : r.pos === 'bajo'
          ? `Lo que pides es ${pct(n.pctAnchor)} más. Este año las empresas en Perú proyectan subir ${pct(avg)} en promedio (EY, 2026): tu pedido es mayor porque no es un ajuste anual, es ponerte al nivel del mercado. Ese es tu argumento.`
          : `Lo que pides es ${pct(n.pctAnchor)} más. Este año las empresas en Perú proyectan subir ${pct(avg)} en promedio (EY, 2026): para pasar de ese número necesitas resultados con cifras o funciones nuevas.`;
    }
    if (a.tamano === 's1' && raise) {
      kit.mype = `Si tu empresa está inscrita en el REMYPE, el efecto anual cambia: en la pequeña empresa son ${money(n.annualSmall)} y en la microempresa ${money(n.annualMicro)}, porque las gratificaciones y la CTS son menores o no existen.`;
    }
    if (a.contrato === 'plazo') {
      kit.legalNote = 'Dato legal: los contratos a plazo fijo pueden encadenarse hasta cinco años en total. Si superas ese plazo, o si haces labores permanentes que no corresponden a la modalidad de tu contrato, consulta con un abogado laboral. Es información para ti, no un argumento para la reunión.';
    }
    if (r.code === 'paquete') {
      kit.package = ['Un bono atado a resultados medibles del semestre.', 'Una capacitación o certificación pagada por la empresa.', 'Horario flexible o días de trabajo remoto.', 'Un título o nivel nuevo que ordene tu siguiente aumento.'];
    }
    if (!raise) {
      kit.alternatives = [
        'Liderar un proyecto visible, con metas y fecha.',
        'Una capacitación o certificación pagada por la empresa.',
        'Un título o nivel nuevo, con revisión de sueldo en seis meses.',
        'Horario flexible o días de trabajo remoto.',
        r.code === 'paquete' ? 'Un bono atado a resultados medibles.' : 'Que tu sueldo se revise en la próxima evaluación, con criterios claros.'
      ];
    }
    if (r.code === 'esperar' && r.cuando) kit.cuando = r.cuando;
    if (a.contrato === 'plazo' && a.vence === 'v1') kit.urgent = 'Tu contrato vence en menos de un mes: pide la reunión hoy. La conversación tiene que ocurrir antes de firmar la renovación.';

    // Mensaje para pedir la reunión
    const saludo = jefe ? `Hola, ${jefe}. ¿Cómo ${T('estás', 'está')}?` : `Hola, ¿cómo ${T('estás', 'está')}?`;
    kit.whatsapp = `${saludo} Quería ${T('pedirte', 'pedirle')} 30 minutos para conversar sobre mis resultados de este año, mi crecimiento y mi remuneración. ¿${T('Te', 'Le')} acomoda el ${d1} en la mañana o ${T('prefieres', 'prefiere')} el ${d2} en la tarde?`;
    const approverText = { gerencia: 'alguien de gerencia', rrhh: 'Recursos Humanos', dueno: 'el dueño' }[k.aprueba];
    kit.whatsappFollow = approverText
      ? `Y para aprovechar bien el tiempo: ¿lo vemos solo ${T('contigo', 'con usted')} o conviene que esté también ${approverText}?`
      : null;
    kit.whatsappNote = 'Nombrar la remuneración desde el mensaje evita que tu jefe se sienta emboscado y le da tiempo de revisar el presupuesto. No negocies por chat: el mensaje solo pide la reunión, en un lugar privado.';

    if (k.oferta === 'escrita') kit.offerNote = 'Tienes una oferta por escrito. Úsala solo si de verdad estás dispuesto a irte, y sin amenazar: "Recibí una propuesta formal. Prefiero seguir aquí; ¿podemos acercarnos a esa cifra?"';
    else if (k.oferta === 'proceso') kit.offerNote = 'Estás en un proceso afuera: no lo menciones hasta tener una oferta por escrito. Una oferta que no existe se nota.';

    // Speech
    const mercado = r.pos === 'bajo'
      ? 'Revisé referencias de mercado, la encuesta de hogares del INEI y guías salariales de este año, para mi puesto, mi experiencia y el tamaño de la empresa, y mi sueldo actual está por debajo de la mediana.'
      : 'Revisé referencias de mercado y mi sueldo está dentro del rango; lo que busco es que refleje lo que estoy aportando hoy.';
    const AUDIT = {
      analitico: 'que no traigo números suficientes, que el presupuesto ya está armado y que lo que voy a pedir es mucho',
      cercano: 'que esta conversación puede ser incómoda, que no es el mejor momento y que lo que voy a pedir es mucho',
      directo: `que esto ${T('te', 'le')} va a quitar tiempo, que el presupuesto ya está armado y que lo que voy a pedir es mucho`,
      evasivo: 'que no es el momento, que hay muchas otras prioridades y que esto podría esperar',
      duro: 'que la respuesta va a ser que no, que el presupuesto está cerrado y que lo que voy a pedir es mucho'
    };
    const audit = AUDIT[k.estilo] || AUDIT.cercano;
    kit.speech = {
      auditoria: `Gracias por el tiempo. Antes de empezar: quizá ${T('pienses', 'piense')} ${audit}. Tiene sentido que lo ${T('pienses', 'piense')}, y aun así quiero ${T('mostrarte', 'mostrarle')} por qué vale la pena conversarlo.`,
      apertura: `Me entusiasma mi trabajo aquí y quiero seguir creciendo; por eso quería conversar ${T('contigo', 'con usted')} sobre mi sueldo. En el último año mi puesto cambió: ${lowerFirst(resp)}.`,
      prueba: `Dos ejemplos concretos: ${lowerFirst(logro1)}. Y ${lowerFirst(logro2)}.`,
      plan: `Traje un resumen de mis resultados y de lo que quiero lograr en los próximos seis meses: ${lowerFirst(plan)}.`,
      mercado: r.pos === 'alto' ? 'Sé que mi sueldo está bien ubicado frente al mercado; lo que propongo es que siga reflejando lo que aporto hoy.' : mercado,
      pedido: r.code === 'trato'
        ? `Por eso quiero proponer un trato: acordemos hoy dos o tres metas para ${reviewMonth}. Si las cumplo, mi sueldo pasa a ${money(n.anchor)} mensuales. ¿Lo dejamos por escrito?`
        : r.code === 'paquete'
          ? `Con base en mis resultados, quiero proponer un ajuste a ${money(n.anchor)} mensuales y que conversemos un bono atado a metas del semestre.`
          : raise
            ? `Con base en mis resultados y en lo que paga el mercado por este puesto, quiero proponer llevar mi sueldo a ${money(n.anchor)} mensuales.`
            : `Por eso quiero proponer que acordemos hoy dos o tres metas para este semestre, que eso venga con ${alt}, y dejar fijada la revisión de mi sueldo en ${reviewMonth}.`,
      silencio: 'Después de decir tu propuesta, haz silencio y deja que responda primero. No la expliques de nuevo ni la rebajes.',
      cierre: `¿Cuándo podríamos tener una respuesta? ¿${T('Te', 'Le')} parece si lo vemos el ${d1} de la próxima semana o ${T('prefieres', 'prefiere')} el ${d2}?`
    };

    // Objeciones
    const respShort = lowerFirst(resp);
    const ask = raise ? `que el ajuste sea a ${money(n.anchor)}` : 'crecer en la siguiente evaluación';
    const list = [
      { id: 'presupuesto', q: 'No hay presupuesto.',
        means: 'Casi siempre quiere decir "no está en el presupuesto de este año", no "no hay plata".',
        reply: `Parece que este año el presupuesto está muy ajustado. [Pausa] ¿Qué tendría que pasar para dejarlo considerado en el próximo? ¿${T('Te', 'Le')} parece si fijamos hoy la revisión, en ${m1} o en ${m2}?`,
        avoid: '"Entonces me tendré que ir." Sin una oferta real, es una amenaza vacía.' },
      { id: 'evaluacion', q: 'Esperemos a la evaluación de desempeño.',
        means: 'Busca un criterio objetivo, o ganar tiempo.',
        reply: `Suena a que ${T('prefieres', 'prefiere')} decidirlo con criterios claros. ¿Qué resultados tendría que mostrar en esa evaluación para ${ask}? Así llego con los números que importan.`,
        avoid: 'Aceptar sin fijar criterios ni fecha.' },
      { id: 'banda', q: 'Ya estás dentro de la banda. Todos en tu puesto ganan lo mismo.',
        means: 'Hay una política salarial, y por ley tu empresa debe informarte sus criterios, aunque no los montos.',
        reply: 'Entiendo que hay una política. ¿Cómo se pasa al siguiente nivel? ¿Qué criterios se usan y en qué plazo? Quiero saber qué me falta.',
        avoid: 'Comparar tu sueldo con el de un compañero.' },
      { id: 'nivel', q: 'Todavía no estás en ese nivel.',
        means: 'Hay una distancia entre lo que haces y lo que la empresa espera para esa cifra, y nadie la ha definido.',
        reply: `Parece que hay algo de mi trabajo que todavía no ${T('ves', 've')} en ese nivel. ¿Qué tendría que lograr concretamente, y en qué plazo? Si lo cumplo, ¿revisamos mi sueldo en ${reviewMonth}?`,
        avoid: 'Discutir si estás o no en ese nivel. Convierte la crítica en metas con fecha.' }
    ];
    if (a.aumento === 'a12' || a.aumento === 'a24' || a.aumento === 'a6') {
      list.push({ id: 'yatesubimos', q: 'Ya te subimos el año pasado.',
        means: 'Mide el aumento contra el pasado, no contra lo que aportas hoy.',
        reply: `Sí, y lo agradezco. Desde entonces mis funciones cambiaron: ${respShort}. ¿Cómo podríamos hacer para que el sueldo refleje el puesto que tengo hoy?`,
        avoid: 'Minimizar el aumento anterior.' });
    } else {
      list.push({ id: 'momento', q: 'Ahorita no es buen momento.',
        means: 'Puede ser cierto o una forma de postergar.',
        reply: `Parece que hay mucho en juego ahora mismo. ¿Sería un problema dejarlo agendado para ${m1} o para ${m2}?`,
        avoid: 'Quedarte con "más adelante" sin fecha.' });
    }
    list.push(
      { id: 'bono', q: 'Te puedo dar un bono, pero el sueldo se queda igual.',
        means: 'Prefiere un gasto único a uno permanente.',
        reply: raise
          ? `Gracias, lo valoro. Un bono reconoce lo que ya pasó; mi propuesta es por el trabajo que hago todos los meses. ¿Cómo podríamos combinar el bono con un ajuste a partir de ${m1}?`
          : 'Gracias, lo valoro. ¿Cómo podríamos atar ese bono a metas del semestre y revisar mi sueldo cuando las cumpla?',
        avoid: 'Aceptar en el momento. Puedes pedir un día para pensarlo.' },
      { id: 'gerencia', q: 'Eso lo decide gerencia.',
        means: 'No es quien decide, o no quiere decidir solo.',
        reply: `Da la impresión de que esto no depende solo de ${T('ti', 'usted')}. ¿Qué ${T('necesitarías', 'necesitaría')} para defenderlo ante gerencia? ¿Lo vemos juntos esta semana o la próxima?`,
        avoid: 'Saltarte a tu jefe y escribir directo a gerencia.' },
      { id: 'escrito', q: 'Pásamelo por escrito y lo vemos.',
        means: 'Puede ser interés real o una forma de postergar.',
        reply: `Claro. ¿Qué es lo más importante que debería incluir para que ${T('te', 'le')} sirva? Hoy mismo ${T('te', 'le')} lo envío. ¿Lo revisamos el ${d1} o el ${d2}?`,
        avoid: 'Mandar un documento largo. Una página con tus logros y tu propuesta basta.' },
      { id: 'ultimatum', q: '¿Me estás diciendo que te vas si no te subimos?',
        means: 'Está probando si es un ultimátum.',
        reply: `No. Quiero seguir creciendo aquí; por eso lo converso ${T('contigo', 'con usted')} antes que con nadie. ¿Qué haría falta para que mi sueldo refleje el trabajo que hago hoy?`,
        avoid: 'Insinuar que te vas sin tener una oferta.' }
    );
    if (a.contrato === 'plazo') {
      list.push({ id: 'renovacion', q: 'Renueva igual y luego lo vemos.',
        means: 'Quiere cerrar la renovación sin cambiar condiciones.',
        reply: 'Parece que la idea es cerrar la renovación rápido. ¿Sería un problema revisarlo antes de firmar, para que la renovación ya salga con el ajuste?',
        avoid: 'Firmar y quedar en "luego". Después de firmar, no hay fecha.' });
    }
    if (['mineria', 'construccion'].includes(a.sector) || ['ing_minas', 'ing_civil', 'seguridad'].includes(a.puesto)) {
      list.push({ id: 'rate', q: 'El sueldo lo fija el contrato con el cliente.',
        means: 'El margen depende del contrato o del proyecto.',
        reply: 'Suena a que el margen depende del contrato. ¿Cuándo se renegocia, y cómo podríamos hacer para que mi ajuste entre en esa propuesta?',
        avoid: 'Discutir el contrato del cliente.' });
    }
    kit.objections = list;

    // Frases para la conversación
    const noQuestion = a.contrato === 'plazo' ? '¿Sería una locura revisar mi sueldo antes de la renovación?' : '¿Es mala idea dejar fijada hoy la fecha de revisión?';
    kit.tools = [
      { name: 'Etiqueta lo que siente o enfrenta', how: 'Empieza con "parece que", "suena a que" o "da la impresión de que", y después calla.',
        ex: ['Parece que este año el presupuesto está muy ajustado.', `Da la impresión de que ${T('te', 'le')} preocupa cómo lo vea gerencia.`] },
      { name: 'Repite sus últimas palabras', how: 'Repite una a tres palabras clave en tono de pregunta. Lo invita a explicar sin que discutas.',
        ex: ['¿Ya está cerrado?', '¿Más adelante?'] },
      { name: 'Pregunta qué o cómo, nunca por qué', how: '"¿Por qué?" suena a reclamo. "¿Qué?" y "¿cómo?" lo ponen a resolver el problema contigo.',
        ex: [raise ? `¿Cómo podríamos hacer para llegar a ${money(n.anchor)}?` : '¿Cómo podríamos hacer para que este proyecto venga con una revisión de sueldo?', '¿Qué tendría que pasar para que gerencia lo apruebe?', `¿Qué es lo que más ${T('te', 'le')} preocupa de aprobar esto?`] },
      { name: 'Haz preguntas fáciles de responder con un no', how: 'Decir "no" da seguridad y abre la conversación en vez de cerrarla.',
        ex: [noQuestion] },
      { name: 'Resume hasta que diga "eso es"', how: 'Antes de proponer, resume su posición. Cuando responda "eso es", siente que lo entendiste.',
        ex: [`A ver si entendí: ${T('valoras', 'valora')} mi trabajo, el presupuesto de este año está cerrado y ${T('necesitas', 'necesita')} algo que ${T('puedas', 'pueda')} defender ante gerencia. ¿Es así?`] },
      { name: 'Di que no sin decir no', how: 'Si la oferta no alcanza, pregunta en vez de rechazar. Con calma y sin ironía.',
        ex: ['¿Cómo podría aceptar eso, considerando todo lo que cambió mi puesto este año?'] }
    ];
    kit.voice = 'Habla despacio y con calma, como locutor de radio de noche. En las afirmaciones, baja el tono al final.';
    if (raise && n.ladder && n.ladder.length > 1) {
      const L = n.ladder;
      kit.ladder = [`Pides ${money(L[0])}. Es un número preciso a propósito: se percibe calculado, no inventado.`];
      if (L.length >= 4) {
        kit.ladder.push(`Antes de bajar, pregunta: "¿Cómo podríamos llegar a ${money(L[0])}?". Si insiste, ${money(L[1])}.`);
        kit.ladder.push(`Si aún no alcanza, ${money(L[2])}.`);
        kit.ladder.push(`Último: ${money(L[3])}, más algo que no es plata: una capacitación pagada, un día de trabajo remoto o una revisión en seis meses.`);
      } else {
        kit.ladder.push(`Último: ${money(L[L.length - 1])}, más algo que no es plata: una capacitación pagada, un día de trabajo remoto o una revisión en seis meses.`);
      }
      kit.ladderRule = 'Cada concesión es más chica que la anterior: así se nota que llegaste a tu límite. Nunca partas la diferencia.';
    }

    // Correo de cierre
    const propuesta = raise
      ? `Mi propuesta: ajuste a ${money(n.anchor)} mensuales.`
      : 'Mi propuesta: liderar [el proyecto acordado] y revisar mi sueldo en seis meses.';
    kit.email = [
      'Asunto: Resumen de nuestra conversación',
      '',
      `${jefe ? 'Hola, ' + jefe : 'Hola'}:`,
      '',
      `Gracias por el tiempo de hoy. ${T('Te', 'Le')} escribo para dejar por escrito lo que conversamos:`,
      '',
      `- ${propuesta}`,
      '- Lo que acordamos: [completa con el siguiente paso].',
      '- Fecha de respuesta o de revisión: [completa con la fecha].',
      '',
      `Quedo pendiente de cualquier información adicional que ${T('necesites', 'necesite')}.`,
      '',
      'Saludos,',
      '[Tu nombre]'
    ].join('\n');

    // Si te dicen que no
    kit.ifNo = [
      `Pregunta: "¿Qué tendría que pasar para llegar a ${raise ? money(n.anchor) : 'ese siguiente nivel'}?" Acuerden dos o tres metas, un plazo y una fecha de revisión.`,
      'Pide que eso quede por escrito, aunque sea en un correo corto. "Más adelante" no es una fecha.',
      'Cada tres o cuatro semanas, reporta tu avance en dos líneas. Siembra hoy y retoma en la fecha.',
      'Negocia lo que no es sueldo: capacitación pagada, un título nuevo, horario flexible o un bono por objetivos.',
      'Pregunta qué criterios usa la política salarial para pasar al siguiente nivel.'
    ];
    if (r.pct < 25) kit.ifNo.push(`Si en esa fecha no hay ajuste y sigues bajo la mediana, mira el mercado: tu pretensión afuera debería ir de ${money(n.pretFrom)} a ${money(n.pretTo)}.`);

    kit.dont = [
      'Hablar de deudas o gastos personales: el aumento se gana por aporte, no por necesidad.',
      'Comparar tu sueldo con el de un compañero.',
      'Amenazar con irte si no tienes una oferta real.',
      'Dar un rango. Si dices "entre 4,500 y 5,000", te quedas con 4,500.',
      'Preguntar "¿por qué no?": suena a reclamo. Cambia a "¿qué haría falta?".',
      'Partir la diferencia: si te ofrecen menos, primero pregunta cómo llegar a tu cifra.',
      'Palabras que te restan: "creo", "siento", "pienso", "solo", "un poquito", "sería justo", "¿podría ser?". Afirma: "propongo", "mis resultados muestran".',
      'Hablar de antigüedad en vez de resultados: el tiempo en el puesto no es un argumento, lo que lograste en ese tiempo sí.'
    ];

    // Si te dicen que sí
    kit.ifYes = [
      'Agradece y para de negociar: no sigas argumentando lo que ya ganaste.',
      'Confirma tres datos: el monto, desde qué mes rige y que se verá en tu boleta.',
      'Ese mismo día, déjalo por escrito con el correo de cierre.',
      `Acuerda cuándo revisarán de nuevo tu desempeño: ${MONTHS[(now.getMonth() + 6) % 12]} es una buena fecha.`
    ];

    // Plan B: tu empleabilidad no depende de una sola reunión
    kit.planB = [
      'Actualiza tu CV y tu perfil de LinkedIn con logros, no con funciones: problema, acción y resultado con número.',
      'Ten dos conversaciones al mes con gente de tu sector: así sabes cuánto se paga afuera y te encuentran cuando hay vacantes.',
      `Tu referencia afuera: una pretensión de ${money(n.pretFrom)} a ${money(n.pretTo)} brutos mensuales.`,
      'Si aparece una oferta por escrito, decídela por lo que ganas en el año y tu crecimiento, no solo por el sueldo mensual.'
    ];
    const off = (typeof MARKET !== 'undefined' && MARKET.offers && MARKET.offers[a.nivel]) || null;
    if (off) kit.planB.push(`En ${off.n} avisos recientes para tu nivel, lo ofrecido equivale a ${Math.round(off.indice * 100)}% de la mediana de mercado: úsalo para saber cuánto se está ofreciendo hoy.`);


    kit.employerCost = raise ? Math.round((n.anchor - Number(a.sueldo)) * CONFIG.employerFactor / 10) * 10 : null;
    kit.sheet = [
      'Mi maletín: resultados y propuesta',
      `Puesto: ${role.label}, ${lowerFirst(level.label)}${tenure ? ', ' + lowerFirst(tenure.label) + ' en el puesto' : ''}.`,
      'Resultados del último año (logro, impacto para la empresa y valor aproximado en soles):',
      `- ${logro1}. Impacto: ${impacto}. Valor: ${clean(k.valor1) || '[S/ aprox.]'}.`,
      `- ${logro2}. Valor: ${clean(k.valor2) || '[S/ aprox.]'}.`,
      '- [Agrega de tres a seis logros más con el mismo formato.]',
      `Responsabilidades nuevas: ${resp.charAt(0).toUpperCase() + resp.slice(1)}.`,
      `Lo que me propongo lograr en los próximos seis meses: ${plan}.`,
      `Referencia de mercado: mi sueldo está ${r.pos === 'bajo' ? 'por debajo de la mediana' : r.pos === 'rango' ? 'dentro del rango' : 'sobre la mediana'} para mi perfil. Mediana estimada: ${money(r.band.p50)} brutos mensuales (encuesta de hogares del INEI 2022-2025 actualizada a 2026 y guías salariales 2026).`,
      raise ? `Propuesta: ${money(n.anchor)} mensuales, desde ${m1}.` : 'Propuesta: proyecto con metas y revisión de sueldo en seis meses.'
    ].join('\n');

    kit.pretension = `Si te llama otra empresa, tu pretensión debería ir de ${money(n.pretFrom)} a ${money(n.pretTo)}: nunca menos de lo que ganas hoy más 10%, porque cambiar de trabajo tiene un costo y un riesgo. Escríbela así: "${money(n.pretFrom)} a ${money(n.pretTo)} brutos mensuales, negociable según el paquete."`;
    kit.days = [d1, d2];
    kit.months = [m1, m2];
    return kit;
  }

  function toText(kit, a) {
    const L = [];
    const n = kit.numbers;
    L.push('PÍDELO BIEN: TU KIT PARA LA REUNIÓN', '');
    if (kit.cuando) L.push('Cuándo usarlo: ' + kit.cuando, '');
    if (kit.timeline) L.push('TU CRONOGRAMA', ...kit.timeline.map(t => `- ${t.fecha}: ${t.paso}`), '');
    if (kit.raise) {
      L.push('TUS NÚMEROS', `Cifra para pedir: ${money(n.anchor)}`, `Objetivo: ${money(n.target)}`, `Piso: ${money(n.floor)}`, `Efecto anual del objetivo: ${money(n.annual)} más al año (régimen general)`);
      if (kit.raiseContext) L.push(kit.raiseContext);
      if (kit.mype) L.push(kit.mype);
      L.push(`Banda de mercado para tu perfil: ${money(n.band.p25)} (P25), ${money(n.band.p50)} (mediana), ${money(n.band.p75)} (P75).`, '');
    } else {
      L.push('QUÉ PEDIR EN VEZ DE SUELDO', ...kit.alternatives.map(x => '- ' + x), '');
    }
    if (kit.prep) L.push('ANTES DE LA REUNIÓN', kit.prep.timing, 'Mensaje: ' + kit.prep.ask, 'Qué decir: ' + kit.prep.script, kit.prep.checkin, kit.prep.log, 'Averigua antes:', ...kit.prep.research.map(x => '- ' + x), '');
    if (kit.package) L.push('AMPLÍA EL PAQUETE', ...kit.package.map(x => '- ' + x), '');
    L.push('MENSAJE PARA PEDIR LA REUNIÓN', kit.whatsapp);
    if (kit.whatsappFollow) L.push(kit.whatsappFollow);
    L.push('', 'TU SPEECH');
    const sp = kit.speech;
    [sp.auditoria, sp.apertura, sp.prueba, sp.plan, sp.mercado, sp.pedido, sp.silencio, sp.cierre].filter(Boolean).forEach((x, i) => L.push(`${i + 1}. ${x}`));
    L.push('');
    if (kit.ladder) L.push('SI TE OFRECEN MENOS', ...kit.ladder.map(x => '- ' + x), kit.ladderRule, '');
    if (kit.tools) {
      L.push('FRASES PARA LA CONVERSACIÓN');
      kit.tools.forEach(t => L.push(`${t.name}: ${t.how}`, ...t.ex.map(x => '   "' + x + '"')));
      L.push(kit.voice, '');
    }
    L.push('LO QUE TE VAN A DECIR Y QUÉ RESPONDER');
    kit.objections.forEach((o, i) => { L.push(`${i + 1}. "${o.q}"`, '   Qué significa: ' + o.means, '   Qué responder: ' + o.reply, '   Qué no hacer: ' + o.avoid); });
    L.push('', 'CORREO DESPUÉS DE LA REUNIÓN', kit.email, '', 'SI TE DICEN QUE NO', ...kit.ifNo.map(x => '- ' + x), '', 'LO QUE NO DEBES DECIR', ...kit.dont.map(x => '- ' + x), '');
    if (kit.ifYes) L.push('SI TE DICEN QUE SÍ', ...kit.ifYes.map(x => '- ' + x), '');
    if (kit.planB) L.push('TU PLAN B', ...kit.planB.map(x => '- ' + x), '');
    L.push('TU MALETÍN', kit.sheet, '');
    if (kit.employerCost) L.push(`Tu propuesta le costaría a la empresa cerca de ${money(kit.employerCost)} al año (régimen general).`, '');
    L.push('SI TE LLAMA OTRA EMPRESA', kit.pretension, '');
    if (kit.legalNote) L.push(kit.legalNote, '');
    L.push('Referencia de mercado, no asesoría legal ni promesa de aumento.');
    return L.join('\n');
  }

  return { build, toText, dayPair, monthPair, money };
})();
