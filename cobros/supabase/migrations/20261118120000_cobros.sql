-- Cobros: un solo servicio de pagos con Mercado Pago (Checkout Pro) para Pídelo Bien, Lo Tuyo y Buen Partido,
-- más el Libro de Reclamaciones de Lo Tuyo y Buen Partido.
-- Solo la función "cobros" usa estas tablas, con la clave secreta del proyecto: RLS activo, sin políticas
-- y sin permisos para anon ni authenticated. Nada de esto se lee ni se escribe desde el navegador.

create table public.cb_productos (
  id text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  sitio text not null check (sitio ~ '^[a-z0-9-]{3,40}$'),
  nombre text not null check (char_length(nombre) between 3 and 120),
  precios jsonb not null check (jsonb_typeof(precios) = 'object'),
  cupones jsonb not null default '{}'::jsonb check (jsonb_typeof(cupones) = 'object'),
  origenes text[] not null,
  descriptor text not null check (descriptor ~ '^[A-Z0-9 ]{3,13}$'),
  prefijo text not null unique check (prefijo ~ '^[A-Z]{2}$'),
  activo boolean not null default true,
  creado timestamptz not null default now()
);
comment on table public.cb_productos is 'Cobros: qué se vende, a qué precio (por variante), cupones de descuento (en %) y a qué páginas puede volver quien paga.';

create table public.cb_pedidos (
  id text primary key check (id ~ '^[a-f0-9]{24}$'),
  producto text not null references public.cb_productos (id),
  variante text not null check (variante ~ '^[a-z0-9]{1,20}$'),
  cupon text check (cupon is null or cupon ~ '^[A-Z0-9]{3,30}$'),
  monto numeric(10, 2) not null check (monto > 0),
  moneda text not null default 'PEN' check (moneda = 'PEN'),
  estado text not null default 'creado' check (estado in ('creado', 'pendiente', 'pagado', 'rechazado', 'revisar', 'devuelto')),
  pago text check (pago is null or pago ~ '^[0-9]{1,20}$'),
  codigo text check (codigo is null or codigo ~ '^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  pagado timestamptz
);
create index cb_pedidos_creado on public.cb_pedidos (creado desc);
create index cb_pedidos_pagados on public.cb_pedidos (pagado desc) where estado = 'pagado';
comment on table public.cb_pedidos is 'Cobros: un pedido por intento de pago. Número aleatorio, producto, precio, estado y el código de acceso entregado. Sin nombre, correo ni datos de tarjeta.';

create table public.cb_accesos (
  huella text primary key check (huella ~ '^[a-f0-9]{64}$'),
  pedido text not null unique references public.cb_pedidos (id) on delete cascade,
  producto text not null references public.cb_productos (id),
  creado timestamptz not null default now()
);
comment on table public.cb_accesos is 'Cobros: huella SHA-256 de cada código de acceso vigente, para abrir lo comprado en otro equipo.';

create table public.cb_config (
  clave text primary key check (clave ~ '^[a-z_]{3,40}$'),
  valor text not null
);
comment on table public.cb_config is 'Cobros: configuración (huella del token del panel).';

create table public.cb_reclamos (
  id bigint generated always as identity primary key,
  sitio text not null check (sitio ~ '^[a-z0-9-]{3,40}$'),
  numero text not null check (numero ~ '^[0-9]{6}-[0-9]{4}$'),
  creado timestamptz not null default now(),
  datos jsonb not null check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) < 16000),
  respondido timestamptz,
  unique (sitio, numero)
);
comment on table public.cb_reclamos is 'Libro de Reclamaciones de Lo Tuyo y Buen Partido: una hoja por fila, con número correlativo por página y año. Se conservan al menos dos años.';

create table public.cb_contadores (
  clave text primary key,
  n integer not null check (n > 0)
);

alter table public.cb_productos enable row level security;
alter table public.cb_pedidos enable row level security;
alter table public.cb_accesos enable row level security;
alter table public.cb_config enable row level security;
alter table public.cb_reclamos enable row level security;
alter table public.cb_contadores enable row level security;

revoke all on table public.cb_productos, public.cb_pedidos, public.cb_accesos, public.cb_config, public.cb_reclamos, public.cb_contadores from anon, authenticated;
grant select, insert, update, delete on table public.cb_productos, public.cb_pedidos, public.cb_accesos, public.cb_config, public.cb_reclamos, public.cb_contadores to service_role;

-- Marca un pedido como pagado y deja su código de acceso, una sola vez: si dos avisos llegan juntos, ambos
-- reciben el mismo código. Si el pedido había sido devuelto y vuelve a quedar pagado, recibe un código nuevo.
create function public.cb_marcar_pagado(p_pedido text, p_pago text, p_codigo text, p_huella text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_producto text;
  v_codigo text;
begin
  update cb_pedidos
     set estado = 'pagado', pago = p_pago, codigo = p_codigo, pagado = now(), actualizado = now()
   where id = p_pedido and (codigo is null or estado = 'devuelto')
  returning producto into v_producto;
  if found then
    delete from cb_accesos where pedido = p_pedido;
    insert into cb_accesos (huella, pedido, producto) values (p_huella, p_pedido, v_producto);
    return p_codigo;
  end if;
  update cb_pedidos set estado = 'pagado', actualizado = now()
   where id = p_pedido and estado <> 'pagado';
  select codigo into v_codigo from cb_pedidos where id = p_pedido;
  return v_codigo;
end;
$$;

-- Devolución o contracargo en Mercado Pago: el pedido queda devuelto y su código deja de abrir en otros equipos.
create function public.cb_marcar_devuelto(p_pedido text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update cb_pedidos set estado = 'devuelto', actualizado = now() where id = p_pedido;
  delete from cb_accesos where pedido = p_pedido;
end;
$$;

-- Registra una hoja del Libro de Reclamaciones con el siguiente número de su página en el año (hora de Lima).
create function public.cb_registrar_reclamo(p_sitio text, p_datos jsonb)
returns table (hoja text, fecha timestamptz)
language plpgsql
set search_path = public
as $$
declare
  v_anio text := to_char(now() at time zone 'America/Lima', 'YYYY');
  v_n integer;
begin
  insert into cb_contadores as c (clave, n) values ('reclamo/' || p_sitio || '/' || v_anio, 1)
  on conflict (clave) do update set n = c.n + 1
  returning c.n into v_n;
  return query
    with nueva as (
      insert into cb_reclamos (sitio, numero, datos)
      values (p_sitio, lpad(v_n::text, 6, '0') || '-' || v_anio, p_datos)
      returning cb_reclamos.numero, cb_reclamos.creado
    )
    select nueva.numero, nueva.creado from nueva;
end;
$$;

revoke all on function public.cb_marcar_pagado(text, text, text, text) from public, anon, authenticated;
revoke all on function public.cb_marcar_devuelto(text) from public, anon, authenticated;
revoke all on function public.cb_registrar_reclamo(text, jsonb) from public, anon, authenticated;
grant execute on function public.cb_marcar_pagado(text, text, text, text) to service_role;
grant execute on function public.cb_marcar_devuelto(text) to service_role;
grant execute on function public.cb_registrar_reclamo(text, jsonb) to service_role;

-- Catálogo. Los precios incluyen IGV. Al cambiar de dominio, agrega el nuevo origen en "origenes".
insert into public.cb_productos (id, sitio, nombre, precios, cupones, origenes, descriptor, prefijo) values
  ('pidelo-bien-kit', 'pidelo-bien', 'Kit para negociar tu sueldo (Pídelo Bien)',
   '{"p2990": 29.90, "p4990": 49.90}', '{}',
   array['https://pidelo-bien.netlify.app', 'https://*--pidelo-bien.netlify.app'], 'PIDELOBIEN', 'PB'),
  ('buen-partido-reporte', 'buen-partido', 'Reporte completo y plan de 30 días (Buen Partido)',
   '{"a": 39, "b": 59}', '{"PATA20": 20}',
   array['https://buen-partido.netlify.app', 'https://*--buen-partido.netlify.app'], 'BUENPARTIDO', 'BP'),
  -- Lo Tuyo cobra con un nombre neutro: el estado de cuenta y el correo de Mercado Pago no dicen de qué se trata
  ('lo-tuyo-reporte', 'lo-tuyo', 'Reporte personalizado',
   '{"unico": 39}', '{}',
   array['https://lo-tuyo.netlify.app', 'https://*--lo-tuyo.netlify.app'], 'PORTUGALRI', 'LT');

-- Huella SHA-256 del token del panel de Pídelo Bien (el mismo token abre las ventas de las tres páginas).
insert into public.cb_config (clave, valor) values
  ('panel_huella', '4f00ae8464cee199dcbc75f763e06e0d7e783d6ae5059566ca8a957a2988808e');
