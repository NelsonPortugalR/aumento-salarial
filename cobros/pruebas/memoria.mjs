// Tienda en memoria con las mismas reglas que las tablas y funciones de la migración (para pruebas).
export function tiendaMemoria({ productos, panelHuella }) {
  const db = { productos: new Map(productos.map(p => [p.id, { activo: true, cupones: {}, ...p }])), pedidos: new Map(), accesos: new Map(), reclamos: [], contadores: new Map() };
  const copia = o => (o ? JSON.parse(JSON.stringify(o)) : null);
  const ahora = () => new Date().toISOString();
  return {
    db,
    async producto(id) { return copia(db.productos.get(id)); },
    async productos() { return [...db.productos.values()].map(copia); },
    async pedido(id) { return copia(db.pedidos.get(id)); },
    async crearPedido(f) {
      if (db.pedidos.has(f.id)) throw new Error('duplicado');
      db.pedidos.set(f.id, { estado: 'creado', moneda: 'PEN', pago: null, codigo: null, pagado: null, creado: ahora(), actualizado: ahora(), ...f });
    },
    async actualizarEstado(id, estado) {
      const p = db.pedidos.get(id);
      if (p && p.estado !== 'pagado') Object.assign(p, { estado, actualizado: ahora() });
    },
    async marcarPagado(pedido, pago, codigo, huella) {
      const p = db.pedidos.get(pedido);
      if (!p) return null;
      if (p.codigo === null || p.estado === 'devuelto') {
        if (db.accesos.has(huella)) throw new Error('huella repetida');
        for (const [h, a] of db.accesos) if (a.pedido === pedido) db.accesos.delete(h);
        Object.assign(p, { estado: 'pagado', pago, codigo, pagado: ahora(), actualizado: ahora() });
        db.accesos.set(huella, { pedido, producto: p.producto });
        return codigo;
      }
      if (p.estado !== 'pagado') Object.assign(p, { estado: 'pagado', actualizado: ahora() });
      return p.codigo;
    },
    async marcarDevuelto(pedido) {
      const p = db.pedidos.get(pedido);
      if (p) Object.assign(p, { estado: 'devuelto', actualizado: ahora() });
      for (const [h, a] of db.accesos) if (a.pedido === pedido) db.accesos.delete(h);
    },
    async acceso(huella, producto) { const a = db.accesos.get(huella); return !!a && a.producto === producto; },
    async config(clave) { return clave === 'panel_huella' ? panelHuella : null; },
    async pagados() { return [...db.pedidos.values()].filter(p => p.estado === 'pagado').map(copia); },
    async recientes(desde) { return [...db.pedidos.values()].filter(p => p.creado >= desde).map(p => ({ producto: p.producto, estado: p.estado })); },
    async registrarReclamo(sitio, datos) {
      const anio = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 4);
      const clave = `reclamo/${sitio}/${anio}`;
      const n = (db.contadores.get(clave) || 0) + 1;
      db.contadores.set(clave, n);
      const fila = { id: db.reclamos.length + 1, sitio, numero: `${String(n).padStart(6, '0')}-${anio}`, creado: ahora(), datos: copia(datos), respondido: null };
      db.reclamos.push(fila);
      return { hoja: fila.numero, fecha: fila.creado };
    },
    async reclamos() { return db.reclamos.slice().reverse().map(copia); },
    async marcarRespondido(id) { const r = db.reclamos.find(x => x.id === id); if (r) r.respondido = ahora(); }
  };
}

// Mercado Pago simulado: preferencias y pagos en memoria
export function mercadoPagoSimulado(token) {
  const MP = { prefs: [], pagos: [], llamadas: 0, caido: false };
  MP.fetch = async (input, init = {}) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    if (u.hostname !== 'api.mercadopago.com') throw new Error('fuera de Mercado Pago: ' + u.hostname);
    MP.llamadas += 1;
    if (MP.caido) return Response.json({ message: 'service unavailable' }, { status: 503 });
    if ((init.headers || {}).Authorization !== `Bearer ${token}`) return Response.json({ message: 'invalid token' }, { status: 401 });
    if (u.pathname === '/checkout/preferences' && init.method === 'POST') {
      const b = JSON.parse(init.body);
      MP.prefs.push({ ...b, idempotencia: init.headers['X-Idempotency-Key'] });
      return Response.json({ id: 'pref-' + MP.prefs.length, init_point: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref-' + MP.prefs.length });
    }
    if (u.pathname === '/v1/payments/search') return Response.json({ results: MP.pagos.filter(p => p.external_reference === u.searchParams.get('external_reference')) });
    const m = u.pathname.match(/^\/v1\/payments\/(\d+)$/);
    if (m) { const p = MP.pagos.find(x => String(x.id) === m[1]); return p ? Response.json(p) : Response.json({ message: 'not found' }, { status: 404 }); }
    return Response.json({ message: 'ruta simulada inexistente' }, { status: 404 });
  };
  return MP;
}
