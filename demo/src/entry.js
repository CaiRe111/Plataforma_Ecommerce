import { startBackend, installFetch, STORES, currentStoreKey, switchStore, resetDemo } from './backend.js';
import startApp from './app.js';

const backend = await startBackend();
installFetch(backend);

// Barra de la demostración: fuera de #root para que la interfaz no la reemplace al dibujarse.
const bar = document.createElement('div');
bar.id = 'demobar';
bar.innerHTML = `<span class="d-tag">Demo · datos ficticios · no se cobra ni se envía nada</span>
  <label class="d-sr" for="d-store">Negocio de ejemplo</label>
  <select id="d-store">${Object.entries(STORES).map(([k, v]) => `<option value="${k}" ${k === currentStoreKey() ? 'selected' : ''}>${v}</option>`).join('')}</select>
  <span class="d-seg"><a href="#/">Tienda</a><a href="#/admin">Panel</a></span>
  <a class="d-lnk" href="#/admin/correos">Correos enviados</a>
  <button id="d-reset" type="button">Restablecer</button>`;
document.getElementById('root').before(bar);
bar.querySelector('#d-store').addEventListener('change', e => { switchStore(e.target.value); location.hash = '#/'; location.reload(); });
bar.querySelector('#d-reset').addEventListener('click', () => { resetDemo(); try { localStorage.removeItem('pe-cart-v1'); localStorage.removeItem('pe-last-order'); } catch { /* sin almacenamiento */ } location.hash = '#/'; location.reload(); });

await startApp();
