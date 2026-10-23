// Misma interfaz que node:sqlite (DatabaseSync) sobre sql.js, la versión de SQLite compilada a JavaScript (sin WebAssembly).
import initSqlJs from 'sql.js/dist/sql-asm.js';

let SQL;
export async function initSqlite() { SQL = await initSqlJs(); }

const bind = args => args.map(v => (v === undefined ? null : typeof v === 'boolean' ? +v : v));

export class DatabaseSync {
  constructor() {
    const restore = globalThis.__SQLITE_RESTORE__;
    globalThis.__SQLITE_RESTORE__ = undefined;
    this.db = restore ? new SQL.Database(restore) : new SQL.Database();
  }
  exec(sql) { this.db.exec(sql); }
  prepare(sql) {
    const db = this.db;
    return {
      run: (...a) => {
        db.run(sql, bind(a));
        return { changes: db.getRowsModified(), lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0] };
      },
      get: (...a) => { const st = db.prepare(sql); try { st.bind(bind(a)); return st.step() ? st.getAsObject() : undefined; } finally { st.free(); } },
      all: (...a) => { const st = db.prepare(sql), out = []; try { st.bind(bind(a)); while (st.step()) out.push(st.getAsObject()); } finally { st.free(); } return out; },
    };
  }
  /** Copia binaria de la base (para guardarla en el navegador). sql.js reabre la base y pierde los PRAGMA, así que se restablecen. */
  snapshot() { const data = this.db.export(); this.db.run('PRAGMA foreign_keys = ON'); return data; }
  close() { this.db.close(); }
}
