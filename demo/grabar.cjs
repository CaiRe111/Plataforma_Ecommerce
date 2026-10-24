/* Graba los videos, GIF y capturas de la página del proyecto (site/) sobre la demo publicable (dist/demo.html).
   Uso:  cd demo && npm run build && node grabar.cjs            (todo)
         node grabar.cjs videos                                 (solo videos y GIF)
         node grabar.cjs capturas                               (solo capturas)
   Requiere Playwright (Chromium) y ffmpeg. Cada video abre la demo desde cero (almacenamiento vacío). */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(__dirname, 'dist', 'demo.html');
const SITE = path.join(ROOT, 'site');
const DIR = { videos: path.join(SITE, 'videos'), gifs: path.join(SITE, 'gifs'), capturas: path.join(SITE, 'capturas'), web: path.join(SITE, 'capturas', 'web') };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'grabar-'));
const modo = process.argv[2] || 'todo';
const solo = process.argv[3]; // nombre de un clip, para regrabar uno solo

/* Cursor visible y onda al hacer clic; la barra de la demo se oculta salvo que se pida */
const INIT = `(()=>{
  const css='#__cur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(720px,450px);transition:transform .6s cubic-bezier(.45,.05,.25,1)}'+
   '.__rip{position:fixed;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid #4f46e5;background:rgba(79,70,229,.18);z-index:2147483646;pointer-events:none;animation:__r .6s ease-out forwards}'+
   '@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.7);opacity:0}}';
  const arranque=()=>{const s=document.createElement('style');s.textContent=css+(localStorage.getItem('__barra')?'':'#demobar{display:none!important}');document.head.appendChild(s);
    const c=document.createElement('div');c.id='__cur';
    c.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.9L4 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arranque);else arranque();
  window.__mv=(x,y)=>{const c=document.getElementById('__cur');if(c)c.style.transform='translate('+(x-4)+'px,'+(y-2)+'px)'};
  window.__rip=(x,y)=>{const r=document.createElement('div');r.className='__rip';r.style.left=x+'px';r.style.top=y+'px';document.body.appendChild(r);setTimeout(()=>r.remove(),800)};
})()`;

const espera = (p, ms) => p.waitForTimeout(ms);
async function mover(p, loc) {
  await loc.scrollIntoViewIfNeeded(); await espera(p, 200);
  const b = await loc.boundingBox(); const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
  await p.evaluate(([x, y]) => window.__mv && window.__mv(x, y), [x, y]); await p.mouse.move(x, y, { steps: 6 }); await espera(p, 650); return { x, y };
}
async function clic(p, loc, ms = 900) { const { x, y } = await mover(p, loc); await p.evaluate(([x, y]) => window.__rip && window.__rip(x, y), [x, y]); await loc.click(); await espera(p, ms); }
async function escribir(p, loc, txt) { await clic(p, loc, 200); await loc.fill(''); await loc.pressSequentially(txt, { delay: 40 }); await espera(p, 300); }
async function elegir(p, loc, val) { const { x, y } = await mover(p, loc); await p.evaluate(([x, y]) => window.__rip && window.__rip(x, y), [x, y]); await loc.selectOption(val); await espera(p, 900); }
async function scrollSuave(p, dy, pasos = 12) { for (let i = 0; i < pasos; i++) { await p.mouse.wheel(0, dy / pasos); await espera(p, 70); } await espera(p, 600); }
const ir = async (p, hash, ms = 1100) => { await p.evaluate(h => { location.hash = h; }, hash); await espera(p, ms); };
const btn = (p, txt) => p.locator('.btn', { hasText: txt }).first();
const card = (p, txt) => p.locator('.card', { hasText: txt }).first();
const act = (p, a) => p.locator(`[data-act="${a}"]`).first();

/* Abre una página nueva (un video por página) con la tienda indicada */
async function abrir(ctx, tienda, { barra = false, hash = '' } = {}) {
  const p = await ctx.newPage(), t0 = Date.now();
  await p.addInitScript(([t, b]) => { try { if (!sessionStorage.getItem('__ini')) { localStorage.clear(); sessionStorage.setItem('__ini', '1'); localStorage.setItem('pe-demo-store', t); if (b) localStorage.setItem('__barra', '1'); } } catch (e) { /* sin almacenamiento */ } }, [tienda, barra]);
  await p.goto(URL + hash); await p.waitForSelector(hash.startsWith('#/admin') ? '.adm' : '.hdr'); await espera(p, 700);
  p.__ofs = (Date.now() - t0) / 1000; return p;
}
const clips = [];
async function cerrar(p, nombre) { await espera(p, 1200); const v = p.video(); await p.close(); clips.push({ nombre, src: await v.path(), ofs: p.__ofs }); }

function ff(args) { execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); }
function duracion(f) { return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim(); }
function convertir({ nombre, src, ofs }, ancho) {
  const mp4 = path.join(DIR.videos, nombre + '.mp4');
  ff(['-ss', String(ofs), '-i', src, '-an', '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', mp4]);
  const d = duracion(mp4);
  ff(['-ss', String((d * 0.62).toFixed(2)), '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(DIR.videos, nombre + '.jpg')]);
  ff(['-i', mp4, '-vf', `fps=11,scale=${ancho}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, path.join(DIR.gifs, nombre + '.gif')]);
  console.log('  ✓', nombre, d.toFixed(1) + ' s');
}

/* Llena el pago con los datos del cliente y avanza hasta la revisión */
async function datosDeCompra(p, rapido) {
  const w = rapido ? (l, t) => l.fill(t) : (l, t) => escribir(p, l, t);
  await w(p.locator('#f-email'), 'laura.mejia@correo.com');
  await w(p.locator('#f-name'), 'Laura Mejía');
  await w(p.locator('#f-phone'), '3105550199');
  await w(p.locator('#f-docNumber'), '1036654321');
  if (await p.locator('#f-address').count()) { await w(p.locator('#f-address'), 'Carrera 43A #5-20'); await w(p.locator('#f-city'), 'Medellín'); }
  await clic(p, act(p, 'co-next'), 1000);
  await clic(p, p.locator('.paycard', { hasText: 'Pago en línea' }).first().or(p.locator('.paycard').first()), 600);
  await clic(p, act(p, 'co-next'), 1200);
}

const GUIONES = {
  async '01-portada-y-tiendas'(ctx) {
    const p = await abrir(ctx, 'moda', { barra: true });
    await scrollSuave(p, 700); await scrollSuave(p, 700); await scrollSuave(p, -1400, 8);
    for (const t of ['alimentos', 'tecnologia', 'digital', 'fantasia']) {
      await mover(p, p.locator('#d-store'));
      await p.selectOption('#d-store', t); await p.waitForSelector('.hero'); await espera(p, 1700);
    }
    await scrollSuave(p, 800); await espera(p, 600);
    return p;
  },
  async '02-catalogo-y-filtros'(ctx) {
    const p = await abrir(ctx, 'tecnologia');
    await clic(p, p.locator('.hero .btn-primary'), 1200);
    await clic(p, p.locator('.fgroup a.flink', { hasText: 'Audio' }), 1100);
    await clic(p, p.locator('.fgroup a.flink', { hasText: 'Todas' }), 1000);
    await clic(p, p.locator('.fgroup label.check', { hasText: 'Menos de' }), 1100);
    await elegir(p, p.locator('.sort select'), { index: 1 });
    await clic(p, p.locator('.chip.x').first(), 1000);
    await escribir(p, p.locator('.hdr .search input'), 'parlante'); await p.keyboard.press('Enter'); await espera(p, 1500);
    return p;
  },
  async '03-ficha-y-carrito'(ctx) {
    const p = await abrir(ctx, 'moda');
    await clic(p, card(p, 'rayas'), 1300);
    await clic(p, p.locator('[data-act="thumb"]').nth(1), 700);
    await clic(p, p.locator('[data-act="thumb"]').nth(2), 700);
    await clic(p, p.locator('.opt', { hasText: /^M$/ }).first(), 600);
    await clic(p, p.locator('[data-act="pdp-qty"][data-d="1"]'), 600);
    await clic(p, act(p, 'add'), 1600);
    await clic(p, act(p, 'cart-qty').last(), 1000);
    await clic(p, btn(p, 'Ver carrito'), 1600);
    return p;
  },
  async '04-ofertas-y-cupon'(ctx) {
    const p = await abrir(ctx, 'moda');
    await clic(p, p.locator('.nav .offer-link'), 1300);
    await scrollSuave(p, 500);
    await clic(p, p.locator('[data-act="apply-code"][data-code="PRIMERA10"]'), 1400);
    await ir(p, '#/catalogo?cat=Camisetas');
    await clic(p, card(p, 'básica'), 1100);
    await clic(p, p.locator('.opt').first(), 500);
    await clic(p, act(p, 'add'), 1200);
    await clic(p, btn(p, 'Ver carrito'), 1500);
    await mover(p, p.locator('.summary'));
    await scrollSuave(p, 300); await espera(p, 1200);
    return p;
  },
  async '05-compra-y-pago-aprobado'(ctx) {
    const p = await abrir(ctx, 'moda');
    await clic(p, card(p, 'lino'), 1100);
    await clic(p, p.locator('.opt').first(), 500);
    await clic(p, act(p, 'add'), 1200);
    await clic(p, btn(p, 'Finalizar compra'), 1300);
    await datosDeCompra(p, false);
    await scrollSuave(p, 300);
    await clic(p, act(p, 'place-order'), 1800);
    await clic(p, p.locator('.paycard', { hasText: 'Nequi' }), 700);
    await clic(p, p.locator('[data-outcome="approved"]'), 2200);
    await scrollSuave(p, 400); await espera(p, 1200);
    return p;
  },
  async '06-pago-rechazado-y-reintento'(ctx) {
    const p = await abrir(ctx, 'tecnologia');
    await clic(p, card(p, 'Audífonos'), 1000);
    await clic(p, act(p, 'add'), 1000);
    await clic(p, btn(p, 'Finalizar compra'), 1100);
    await datosDeCompra(p, true);
    await clic(p, act(p, 'place-order'), 1700);
    await clic(p, p.locator('[data-outcome="declined"]'), 2000);
    await clic(p, act(p, 'pay-again'), 1500);
    await clic(p, p.locator('[data-outcome="approved"]'), 2200);
    return p;
  },
  async '07-cuenta-y-cliente-fiel'(ctx) {
    const p = await abrir(ctx, 'moda');
    await clic(p, p.locator('.hdr a[href="#/cuenta"]').first(), 1000);
    await escribir(p, p.locator('#a-email'), 'mateo.gomez@correo.com');
    await escribir(p, p.locator('#a-pass'), 'demo12345');
    await clic(p, p.locator('form .btn-primary'), 1700);
    await scrollSuave(p, 500);
    await clic(p, p.locator('.nav .offer-link'), 1300);
    await scrollSuave(p, 500);
    await ir(p, '#/catalogo?cat=Pantalones', 1500);
    await clic(p, card(p, 'cargo'), 1700);
    return p;
  },
  async '08-panel-resumen'(ctx) {
    const p = await abrir(ctx, 'moda', { hash: '#/admin' });
    await espera(p, 800); await scrollSuave(p, 600); await scrollSuave(p, 600); await scrollSuave(p, -1200, 8);
    await clic(p, p.locator('.side a', { hasText: 'Pedidos' }), 1500);
    return p;
  },
  async '09-crear-producto'(ctx) {
    const p = await abrir(ctx, 'moda', { hash: '#/admin/productos' });
    await clic(p, btn(p, 'Nuevo producto'), 1200);
    await escribir(p, p.locator('#e-name'), 'Chaqueta de jean');
    await escribir(p, p.locator('#e-desc'), 'Jean grueso con forro de algodón.');
    await escribir(p, p.locator('#e-cat'), 'Chaquetas');
    await escribir(p, p.locator('#e-price'), '219900');
    await escribir(p, p.locator('#e-compare'), '249900');
    await escribir(p, p.locator('#e-stock'), '12');
    await escribir(p, p.locator('#e-opts'), 'Talla: S, M, L');
    await clic(p, p.locator('button[type="submit"]', { hasText: 'Crear producto' }), 1600);
    await clic(p, btn(p, 'Ver tienda'), 1200);
    await ir(p, '#/catalogo?cat=Chaquetas', 1600);
    return p;
  },
  async '10-inventario'(ctx) {
    const p = await abrir(ctx, 'alimentos', { hash: '#/admin/inventario' });
    const fila = p.locator('.tbl tbody tr').nth(1);
    for (let i = 0; i < 3; i++) await clic(p, fila.locator('[data-act="stock"][data-d="1"]'), 450);
    await clic(p, fila.locator('[data-act="stock"][data-d="-1"]'), 700);
    const inp = p.locator('.tbl tbody tr').nth(3).locator('input[type="number"]');
    await escribir(p, inp, '2'); await p.keyboard.press('Tab'); await espera(p, 1300);
    await scrollSuave(p, 400); await espera(p, 1000);
    return p;
  },
  async '11-gestion-de-pedidos'(ctx) {
    const p = await abrir(ctx, 'moda', { hash: '#/admin/pedidos' });
    await clic(p, p.locator('.tabs a').nth(1), 1100);
    await clic(p, p.locator('.tbl tbody tr a').first(), 1500);
    for (let i = 0; i < 2; i++) { const b = act(p, 'order-next'); if (await b.count()) await clic(p, b, 1400); }
    await scrollSuave(p, 400); await espera(p, 1000);
    return p;
  },
  async '12-promociones'(ctx) {
    const p = await abrir(ctx, 'moda', { hash: '#/admin/promociones' });
    await clic(p, btn(p, 'Nueva promoción'), 1100);
    await escribir(p, p.locator('#r-name'), 'Fin de semana de calzado');
    await escribir(p, p.locator('#r-desc'), '20 % en todo el calzado');
    await escribir(p, p.locator('#r-value'), '20');
    await elegir(p, p.locator('#r-scope'), 'Calzado');
    await escribir(p, p.locator('#r-code'), 'CALZADO20');
    await clic(p, p.locator('button[type="submit"]', { hasText: 'Crear promoción' }), 1500);
    await clic(p, btn(p, 'Ver tienda'), 1300);
    await clic(p, p.locator('.nav .offer-link'), 1500);
    return p;
  },
  async '13-clientes-y-programa-fiel'(ctx) {
    const p = await abrir(ctx, 'moda', { hash: '#/admin/clientes' });
    await escribir(p, p.locator('#l-disc'), '8');
    await clic(p, p.locator('button[type="submit"]', { hasText: 'Guardar reglas' }), 1300);
    await clic(p, p.locator('[data-act="cust-set"][data-type="fiel"]').first(), 1500);
    await scrollSuave(p, 300); await espera(p, 800);
    return p;
  },
  async '14-facturacion-y-correos'(ctx) {
    const p = await abrir(ctx, 'moda', { hash: '#/admin/facturacion' });
    await scrollSuave(p, 600); await scrollSuave(p, 600); await scrollSuave(p, -1200, 8);
    await clic(p, p.locator('.side a', { hasText: 'Pedidos' }), 1100);
    await clic(p, p.locator('.tbl tbody tr a').first(), 1200);
    for (let i = 0; i < 2; i++) { const b = act(p, 'order-next'); if (await b.count()) await clic(p, b, 1200); }
    await clic(p, p.locator('.side a', { hasText: 'Correos' }), 1300);
    const v = act(p, 'mail-view'); if (await v.count()) await clic(p, v, 1500);
    await scrollSuave(p, 500); await espera(p, 1200);
    return p;
  },
  async '15-cambiar-tema'(ctx) {
    const p = await abrir(ctx, 'moda', { hash: '#/admin/ajustes' });
    await elegir(p, p.locator('#s-theme'), 'fantasia');
    await clic(p, p.locator('form button[type="submit"]').first(), 1300);
    await clic(p, btn(p, 'Ver tienda'), 1800);
    await scrollSuave(p, 700); await scrollSuave(p, -700, 8);
    return p;
  },
};

async function grabarVideos(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: TMP, size: { width: 1440, height: 900 } }, locale: 'es-CO' });
  await ctx.addInitScript(INIT);
  for (const [nombre, guion] of Object.entries(GUIONES)) {
    if (solo && solo !== nombre) continue;
    console.log('▶', nombre);
    try { await cerrar(await guion(ctx), nombre); } catch (e) { console.error('  ✗', nombre, e.message.split('\n')[0]); for (const pg of ctx.pages()) await pg.close(); }
  }
  /* Recorrido completo: compra en la tienda y el pedido avanzando en el panel */
  if (!solo || solo === 'recorrido') {
    console.log('▶ recorrido-completo-compra');
    const p = await abrir(ctx, 'digital');
    await scrollSuave(p, 500); await scrollSuave(p, -500, 6);
    await clic(p, p.locator('.cat-grid a', { hasText: 'Cursos' }), 1200);
    await clic(p, p.locator('.card').first(), 1300);
    await clic(p, act(p, 'add'), 1300);
    await clic(p, btn(p, 'Finalizar compra'), 1200);
    await datosDeCompra(p, false);
    await clic(p, act(p, 'place-order'), 1600);
    await clic(p, p.locator('[data-outcome="approved"]'), 2200);
    await ir(p, '#/admin', 1600);
    await clic(p, p.locator('.side a', { hasText: 'Pedidos' }), 1300);
    await clic(p, p.locator('.tbl tbody tr a').first(), 1500);
    const b = act(p, 'order-next'); if (await b.count()) await clic(p, b, 1500);
    await clic(p, p.locator('.side a', { hasText: 'Correos' }), 1600);
    await cerrar(p, 'recorrido-completo-compra');
  }
  await ctx.close();

  if (!solo || solo === 'movil') {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: TMP, size: { width: 390, height: 844 } }, locale: 'es-CO' });
    await m.addInitScript(INIT);
    console.log('▶ 16-movil');
    const p = await abrir(m, 'alimentos');
    await scrollSuave(p, 900); await scrollSuave(p, -900, 8);
    await clic(p, p.locator('.menu-btn'), 1000);
    await clic(p, p.locator('.drawer a', { hasText: 'Panadería' }), 1200);
    await clic(p, p.locator('.card').first(), 1200);
    await clic(p, act(p, 'add'), 1500);
    await clic(p, btn(p, 'Finalizar compra'), 1300);
    await scrollSuave(p, 500); await espera(p, 800);
    await cerrar(p, '16-movil');
    await m.close();
  }

  for (const c of clips) convertir(c, c.nombre === '16-movil' ? 390 : 860);
}

/* Capturas: PNG a 2× (móvil 3×) y su versión WebP en capturas/web */
async function grabarCapturas(browser) {
  const n = [];
  const tomar = async (p, nombre, full = false) => {
    const f = path.join(DIR.capturas, nombre + '.png'); await espera(p, 500); await p.screenshot({ path: f, fullPage: full }); n.push(nombre); console.log('  📷', nombre);
  };
  const pagina = async (tienda, opc = {}) => {
    const ctx = await browser.newContext({ viewport: opc.vp || { width: 1440, height: 900 }, deviceScaleFactor: opc.dpr || 2, isMobile: !!opc.movil, hasTouch: !!opc.movil, colorScheme: opc.oscuro ? 'dark' : 'light', locale: 'es-CO' });
    await ctx.addInitScript(([t, b]) => { try { localStorage.setItem('pe-demo-store', t); b ? localStorage.setItem('__barra', '1') : localStorage.removeItem('__barra'); } catch (e) { /* sin almacenamiento */ } }, [tienda, !!opc.barra]);
    await ctx.addInitScript(`(()=>{const s=document.createElement('style');s.textContent=localStorage.getItem('__barra')?'':'#demobar{display:none!important}';document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(s))})()`);
    const p = await ctx.newPage(); await p.goto(URL + (opc.hash || '')); await p.waitForSelector((opc.hash || '').startsWith('#/admin') ? '.adm' : '.hdr'); await espera(p, 600);
    p.__ctx = ctx; return p;
  };
  let p;
  /* tienda */
  p = await pagina('moda', { barra: true }); await tomar(p, '01-portada-moda'); await p.__ctx.close();
  for (const [i, t] of [['02', 'alimentos'], ['03', 'tecnologia'], ['04', 'digital'], ['05', 'fantasia']]) { p = await pagina(t); await tomar(p, `${i}-portada-${t}`); await p.__ctx.close(); }
  p = await pagina('cafe'); await tomar(p, '31-portada-cafe'); await p.__ctx.close();
  p = await pagina('tecnologia', { hash: '#/catalogo' }); await tomar(p, '06-catalogo-con-filtros');
  await ir(p, '#/producto/' + await p.locator('.card').first().getAttribute('href').then(h => h.split('/').pop())); await tomar(p, '07-ficha-de-producto');
  await p.locator('.opt').first().click().catch(() => {}); await act(p, 'add').click(); await espera(p, 800); await tomar(p, '08-carrito-lateral');
  await p.__ctx.close();
  p = await pagina('moda', { hash: '#/ofertas' }); await tomar(p, '09-ofertas-y-cupones');
  await p.locator('[data-act="apply-code"][data-code="PRIMERA10"]').click(); await espera(p, 600);
  await ir(p, '#/catalogo?cat=Pantalones'); await p.locator('.card').first().click(); await espera(p, 700); await p.locator('.opt').first().click().catch(() => {}); await act(p, 'add').click(); await espera(p, 600);
  await ir(p, '#/carrito'); await tomar(p, '10-carrito-con-cupon');
  await ir(p, '#/pago'); await tomar(p, '11-pago-datos');
  await datosDeCompra(p, true); await tomar(p, '12-pago-revision');
  await act(p, 'place-order').click(); await espera(p, 1200); await tomar(p, '13-pasarela-simulada');
  await p.locator('[data-outcome="approved"]').click(); await espera(p, 1500); await tomar(p, '14-pedido-confirmado');
  await p.__ctx.close();
  p = await pagina('moda', { hash: '#/cuenta' });
  await p.locator('#a-email').fill('mateo.gomez@correo.com'); await p.locator('#a-pass').fill('demo12345'); await p.locator('form .btn-primary').click(); await espera(p, 1200);
  await tomar(p, '15-cuenta-cliente-fiel'); await p.__ctx.close();
  /* panel */
  p = await pagina('moda', { hash: '#/admin' }); await tomar(p, '16-panel-resumen');
  for (const [k, nombre] of [['productos', '17-panel-productos'], ['inventario', '19-panel-inventario'], ['pedidos', '20-panel-pedidos'], ['clientes', '22-panel-clientes'], ['promociones', '23-panel-promociones'], ['facturacion', '24-panel-facturacion'], ['correos', '25-panel-correos'], ['ajustes', '26-panel-ajustes']]) {
    if (k === 'correos') { await ir(p, '#/admin/pedidos'); await p.locator('.tbl tbody tr a').first().click(); await espera(p, 800); for (let i = 0; i < 2; i++) { const b = act(p, 'order-next'); if (await b.count()) { await b.click(); await espera(p, 800); } } }
    await ir(p, '#/admin/' + k);
    if (k === 'correos' && await act(p, 'mail-view').count()) { await act(p, 'mail-view').click(); await espera(p, 600); }
    await tomar(p, nombre);
    if (k === 'productos') { await p.locator('.cell-prod a').first().click(); await espera(p, 900); await tomar(p, '18-panel-editar-producto'); }
    if (k === 'pedidos') { await p.locator('.tbl tbody tr a').first().click(); await espera(p, 900); await tomar(p, '21-panel-detalle-de-pedido'); }
  }
  await p.__ctx.close();
  /* oscuro y móvil */
  p = await pagina('digital', { oscuro: true }); await tomar(p, '27-modo-oscuro'); await p.__ctx.close();
  p = await pagina('alimentos', { vp: { width: 390, height: 844 }, dpr: 3, movil: true }); await tomar(p, '28-movil-portada');
  await p.locator('.menu-btn').click(); await espera(p, 600); await tomar(p, '29-movil-menu');
  await p.locator('.drawer [data-act="close"]').click(); await espera(p, 400);
  await p.locator('.card').first().click(); await espera(p, 800); await act(p, 'add').click(); await espera(p, 900); await tomar(p, '30-movil-carrito');
  await p.__ctx.close();

  fs.mkdirSync(DIR.web, { recursive: true });
  for (const f of n) ff(['-i', path.join(DIR.capturas, f + '.png'), '-vf', `scale='min(1600,iw)':-1:flags=lanczos`, '-quality', '82', path.join(DIR.web, f + '.webp')]);
}

(async () => {
  Object.values(DIR).forEach(d => fs.mkdirSync(d, { recursive: true }));
  const browser = await chromium.launch();
  try {
    if (modo === 'todo' || modo === 'videos') await grabarVideos(browser);
    if (modo === 'todo' || modo === 'capturas') await grabarCapturas(browser);
  } finally { await browser.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
