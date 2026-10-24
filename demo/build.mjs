// Genera dist/demo.html: una sola página con la tienda, el panel y el servidor completos para correr en el navegador.
//   cd demo && npm install && npm run build
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(HERE, '..', 'app');
const out = path.join(HERE, '.build');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });

// La aplicación se arranca desde fuera (después de iniciar el servidor del navegador), así que su IIFE pasa a ser una función.
let app = fs.readFileSync(path.join(APP, 'public', 'app.js'), 'utf8');
app = app.replace("from '/shared/pricing.js'", `from '${path.join(APP, 'src', 'shared', 'pricing.js')}'`);
if (!app.includes('(async () => {\n') || !app.trimEnd().endsWith('})();')) throw new Error('app.js cambió: revisa cómo se envuelve.');
app = app.replace('(async () => {\n', 'export default async function startApp() {\n').replace(/\}\)\(\);\s*$/, '}\n');
fs.writeFileSync(path.join(out, 'app.js'), app);


const shim = f => path.join(HERE, 'shims', f);
const r = await build({
  entryPoints: [path.join(HERE, 'src', 'entry.js')], bundle: true, format: 'esm', target: 'es2022', minify: true, write: false, legalComments: 'none',
  inject: [shim('inject.js')], loader: { '.json': 'json' }, logLevel: 'warning',
  alias: { 'node:crypto': shim('crypto.js'), 'node:util': shim('util.js'), 'node:fs': shim('fs.js'), 'node:path': shim('path.js'), 'node:sqlite': shim('sqlite.js'), fs: shim('fs.js'), path: shim('path.js'), crypto: shim('crypto.js') },
  nodePaths: [path.join(HERE, 'node_modules')], resolveExtensions: ['.js', '.mjs', '.json'],
  plugins: [{ name: 'app-modules', setup(b) {
    b.onResolve({ filter: /^\.\/app\.js$/ }, () => ({ path: path.join(out, 'app.js') }));
  } }],
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// Estilos con las fuentes incrustadas (una página publicada no puede cargar archivos de fuentes propios).
let css = fs.readFileSync(path.join(APP, 'public', 'styles.css'), 'utf8');
css = css.replace(/url\('\/fonts\/([^']+\.woff2)'\)/g, (_, f) => `url('data:font/woff2;base64,${fs.readFileSync(path.join(APP, 'public', 'fonts', f)).toString('base64')}')`);
const demoCss = `
#demobar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 8px max(16px, env(safe-area-inset-right, 0px)) 8px max(16px, env(safe-area-inset-left, 0px)); background: #1b1f2a; color: #e9ecf3; font: 13px/1.3 system-ui, sans-serif; position: relative; z-index: 25; }
#demobar .d-tag { font-weight: 650; }
#demobar select { min-height: 30px; width: auto; max-width: 100%; padding: 0 8px; font: inherit; background: #2a3040; color: #e9ecf3; border: 1px solid #3c4458; border-radius: 4px; }
#demobar .d-seg { display: inline-flex; border: 1px solid #3c4458; border-radius: 4px; overflow: hidden; }
#demobar .d-seg a { padding: 5px 12px; color: inherit; text-decoration: none; font-weight: 600; }
#demobar .d-seg a:hover { background: #2a3040; }
#demobar .d-lnk, #demobar button { color: #cdd3e2; background: none; border: 0; padding: 4px 2px; font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
#demobar .d-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
`;
const html = `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Demo Tienda Online</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}${demoCss}</style>
<div id="root"></div><div id="overlay"></div><div id="toast" class="toast" role="status" aria-live="polite"></div>
<noscript>Esta demostración necesita JavaScript.</noscript>
<script type="module">${js}</script>
`;
fs.writeFileSync(path.join(HERE, 'dist', 'demo.html'), html);
// Copia publicable junto a la página del proyecto (site/).
fs.mkdirSync(path.join(HERE, '..', 'site', 'demo'), { recursive: true });
fs.writeFileSync(path.join(HERE, '..', 'site', 'demo', 'index.html'), html);
console.log(`dist/demo.html: ${(html.length / 1e6).toFixed(2)} MB`);
