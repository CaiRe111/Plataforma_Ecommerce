// Migraciones numeradas. Se aplican en orden y quedan registradas en schema_migrations.
export const MIGRATIONS = [
  {
    id: 1,
    name: 'init',
    sql: `
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price >= 0),
  compare_price INTEGER,
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  kind TEXT NOT NULL DEFAULT 'box',
  hue INTEGER NOT NULL DEFAULT 215,
  attrs TEXT NOT NULL DEFAULT '{}',
  options TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active','draft')),
  digital INTEGER NOT NULL DEFAULT 0,
  tax_rate INTEGER NOT NULL DEFAULT 19 CHECK (tax_rate IN (0, 5, 19)),
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_products_status ON products(status);

CREATE TABLE promos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('percent','fixed','shipping')),
  value INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'all',
  code TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','fiel')),
  min_total INTEGER NOT NULL DEFAULT 0,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX idx_promos_code ON promos(code) WHERE code <> '';

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  type_override TEXT CHECK (type_override IN ('normal','fiel')),
  doc_type TEXT NOT NULL DEFAULT '',
  doc_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('admin','customer')),
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_token TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT '',
  doc_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  subtotal INTEGER NOT NULL,
  loyalty_discount INTEGER NOT NULL DEFAULT 0,
  coupon_code TEXT NOT NULL DEFAULT '',
  coupon_discount INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  physical INTEGER NOT NULL DEFAULT 1,
  fiel INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL CHECK (method IN ('wompi','transfer','cod')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','preparing','shipped','delivered','cancelled')),
  stock_released INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT
);
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_status ON orders(status);
INSERT INTO sqlite_sequence(name, seq) VALUES ('orders', 1000);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price INTEGER NOT NULL,
  opts TEXT NOT NULL DEFAULT '{}',
  digital INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_items_order ON order_items(order_id);

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  provider_tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'CREATED',
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT '',
  raw TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_payments_order ON payments(order_id);

CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`,
  },
  {
    id: 2,
    name: 'invoicing',
    sql: `
CREATE TABLE invoice_resolutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resolution_number TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  range_from INTEGER NOT NULL,
  range_to INTEGER NOT NULL,
  next_number INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  technical_key TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  CHECK (range_to >= range_from)
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice','credit_note')),
  resolution_id INTEGER REFERENCES invoice_resolutions(id),
  prefix TEXT NOT NULL DEFAULT '',
  number INTEGER,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','issued','rejected','error','not_applicable')),
  provider TEXT NOT NULL DEFAULT '',
  cufe TEXT NOT NULL DEFAULT '',
  document TEXT,
  provider_response TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  next_attempt_at TEXT,
  issued_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (order_id, kind)
);
CREATE INDEX idx_invoices_status ON invoices(status);
`,
  },
];
