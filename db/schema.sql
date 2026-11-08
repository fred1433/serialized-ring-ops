-- Everything here describes fictional stock and fictional orders.
create table units (
  uuid uuid primary key,
  size int not null check (size between 3 and 15),
  lot text not null,
  manifest_line int not null,
  status text not null default 'manifested',
  qa text not null default 'pending',
  intake_at timestamptz
);

create table orders (
  id serial primary key,
  channel text not null,
  channel_ref text not null,
  customer text not null,
  paid_at timestamptz not null,
  status text not null default 'open',
  unique (channel, channel_ref)
);
alter sequence orders_id_seq restart with 1000;

create sequence size_request_rank;
create table size_requests (
  order_id int primary key references orders (id),
  size int not null,
  submitted_at timestamptz not null,
  rank bigint not null unique default nextval('size_request_rank')
);

create table reservations (
  id serial primary key,
  order_id int not null references orders (id),
  unit_uuid uuid not null references units (uuid),
  active boolean not null default true,
  reserved_at timestamptz not null,
  released_at timestamptz
);
create unique index one_active_reservation_per_unit on reservations (unit_uuid) where active;
create unique index one_active_reservation_per_order on reservations (order_id) where active;

-- The ring's parcel. Label, validation, handoff and delivery are separate facts.
create table parcels (
  order_id int primary key references orders (id),
  unit_uuid uuid references units (uuid),
  label_created_at timestamptz,
  validated_at timestamptz,
  handed_off_at timestamptz,
  delivered_at timestamptz
);

-- The sizer has its own parcel and never touches the ring's.
create table sizer_parcels (
  order_id int primary key references orders (id),
  delivered_at timestamptz not null
);

create table packing_events (
  id bigserial primary key,
  at timestamptz not null,
  kind text not null,
  actor text not null,
  order_id int,
  unit_uuid text,
  reason text,
  detail text not null
);

create table webhook_deliveries (
  provider text not null,
  event_id text not null,
  order_id int not null references orders (id),
  primary key (provider, event_id)
);
