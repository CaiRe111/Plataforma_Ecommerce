import { updateStore } from '../domain/settings.js';
import { createProduct } from '../domain/catalog.js';
import { createPromo } from '../domain/promos.js';
import { hashPassword } from '../auth.js';

/** Carga en la base un catálogo de demostración ya leído (lo usa también la demo que corre en el navegador). */
export async function applyDemo(db, d, { accounts = false } = {}) {
  if (db.prepare('SELECT COUNT(*) c FROM products').get().c > 0) throw new Error('Esta instalación ya tiene productos. No se cargó la demostración.');
  updateStore(db, d.store);
  d.categories.forEach((c, i) => db.prepare('INSERT OR IGNORE INTO categories (name, position) VALUES (?, ?)').run(c, i));
  d.products.forEach(p => createProduct(db, p));
  d.promos.forEach(p => createPromo(db, { ...p, ends: p.endsInDays ? new Date(Date.now() + p.endsInDays * 864e5).toISOString() : null, active: true }));
  if (accounts) {
    const hash = await hashPassword('demo12345');
    db.prepare("INSERT OR IGNORE INTO customers (email, name, phone, password_hash, type_override) VALUES ('valentina.rios@correo.com', 'Valentina Ríos', '3105550142', ?, 'normal')").run(hash);
    db.prepare("INSERT OR IGNORE INTO customers (email, name, phone, password_hash, type_override) VALUES ('mateo.gomez@correo.com', 'Mateo Gómez', '3115550177', ?, 'fiel')").run(hash);
  }
  return d.products.length;
}
