---
name: prototipo-ecommerce
description: Convierte una idea de negocio en un prototipo de tienda de esta plataforma (catálogo semilla en app/src/seed/demo.json, tema visual y demo publicable en demo/dist/demo.html). Usar cuando pidan "crea una tienda para…", "prototipo de ecommerce para…", "genera la demo de mi negocio" o describan un negocio que quieren ver como tienda.
---

# Prototipo de ecommerce a partir de una idea de negocio

Un prototipo en este repositorio **no es código nuevo**: es una entrada más en `app/src/seed/demo.json`
(tienda, categorías, productos, promociones) que la aplicación existente carga tal cual.
El demo del navegador (`demo/`) lista automáticamente todas las entradas de ese archivo.
No modifiques el backend, la tienda (`app/public`) ni los pagos para hacer un prototipo.

Esquema completo y reglas de cada campo: [references/esquema-catalogo.md](references/esquema-catalogo.md).

## Pasos

### 1. Entender la idea
Extrae de la descripción del usuario:
- Nombre comercial, frase (`tagline`) y a quién vende.
- Tipo: `physical` (envíos) o `digital` (cursos, plantillas, sesiones; sin envío ni existencias).
- 3 a 5 categorías y 2 a 4 filtros (`facets`) que tengan sentido para comparar sus productos.
- Tema: `clasico` por defecto; `fantasia` solo si la idea es medieval, juegos de rol, fantasía o similar.

Pregunta solo si falta algo que cambie el catálogo (por ejemplo, si vende productos físicos o digitales).
Lo demás (precios, textos, envío, fidelización) lo decides tú con valores realistas para Colombia.

### 2. Escribir el catálogo
Crea un archivo JSON en el scratchpad con **una tienda** (sin la clave exterior), siguiendo el esquema:
- `label`: rubro corto en español (aparece en el selector del demo: "Nombre · Rubro").
- 8 productos (como las tiendas existentes), todos `"status": "active"`, repartidos entre las categorías.
- Precios enteros en pesos colombianos, sin decimales. Usa `compare` (precio anterior mayor) en 1 o 2 productos.
- `kind` solo de la lista de ilustraciones; elige la más cercana al producto.
- `attrs` con las mismas claves que `facets`; `options` solo para variantes reales (talla, color, presentación).
- Productos digitales: `"digital": true`, `"stock": null`.
- 4 promociones, mismo patrón que las demás tiendas: una por categoría, la de bienvenida `PRIMERA10`,
  una exclusiva para clientes fieles (`audience: "fiel"`) y una de monto fijo o envío gratis.
- Textos en español neutro colombiano, concretos y sin promesas exageradas. Datos de transferencia ficticios
  (Bancolombia, cuenta de ahorros 000-111222-33, a nombre de la tienda).

### 3. Validar y agregar
Clave: minúsculas, sin tildes ni espacios (por ejemplo `cafe`, `mascotas`).

```bash
node .claude/skills/prototipo-ecommerce/scripts/validar-catalogo.mjs <archivo.json>   # solo revisa
node .claude/skills/prototipo-ecommerce/scripts/agregar-tienda.mjs <clave> <archivo.json>  # revisa y agrega a demo.json
```

El validador informa errores (lo que la aplicación rechazaría o cambiaría en silencio) y además carga la
tienda en una base en memoria con el mismo código del servidor. Corrige hasta que no haya errores.
`agregar-tienda.mjs` conserva el formato de `demo.json` y no sobrescribe una clave existente
(usa `--reemplazar` solo si el usuario lo pide).

Actualiza la lista de catálogos del comentario inicial de `app/src/seed/index.js`.

### 4. Probar

```bash
cd app && npm test
rm -rf /tmp/proto-<clave> && DATA_DIR=/tmp/proto-<clave> ADMIN_EMAIL=admin@demo.co ADMIN_PASSWORD=clave-demo-123 npm run seed:demo -- <clave> --accounts
cd ../demo && npm install && npm run build   # genera demo/dist/demo.html
```

Opcional: revisar la tienda con Playwright eligiendo la tienda en el selector `#d-store` y tomando una
captura de la portada. `demo.html` es un fragmento sin `<meta charset>` (la página publicada lo agrega):
sírvelo con `page.route(...)` y `contentType: 'text/html; charset=utf-8'`; abierto con `file://` las tildes salen mal.

### 5. Entregar
- Muestra al usuario un resumen: nombre, tipo, tema, categorías, productos con precio y promociones.
- Publica `demo/dist/demo.html` como Artifact (o entrégalo como archivo) para que vea la tienda funcionando.
- **No hagas commit de la tienda hasta que el usuario confirme que está bien.** Si pide cambios, edita el
  JSON, vuelve a ejecutar `agregar-tienda.mjs <clave> <archivo> --reemplazar` y repite los pasos 4 y 5.
