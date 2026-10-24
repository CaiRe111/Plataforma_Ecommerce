# Esquema de una tienda en `app/src/seed/demo.json`

Cada clave del archivo es una tienda. Las reglas salen de `app/src/domain/settings.js` (`updateStore`),
`app/src/domain/catalog.js` (`normalizeProduct`) y `app/src/domain/promos.js` (`normalizePromo`).

```json
{
  "label": "Café",
  "store": { ... },
  "categories": ["Café en grano", "Métodos", "Accesorios"],
  "products": [ ... ],
  "promos": [ ... ]
}
```

## store

| Campo | Regla |
|---|---|
| `name` | Obligatorio, máx. 80 caracteres. |
| `tagline` | Máx. 200. |
| `hue` | 0–360. Tono del color principal (215 azul, 150 verde, 25 terracota, 8 rojo, 280 morado). |
| `theme` | Opcional: `clasico` (por defecto) o `fantasia`. |
| `type` | `physical` o `digital`. |
| `hero` | `{ eyebrow ≤60, title ≤140, cta ≤40 }`. |
| `perks` | Máx. 3: `{ t ≤60, d ≤140 }`. |
| `facets` | 1–4 nombres de atributos para filtrar (≤30). Deben existir como claves en `attrs` de los productos. |
| `lowStock` | Umbral de "pocas unidades", normalmente 5. |
| `shipping` | `{ flat, freeFrom }` en pesos. En tiendas digitales usar `{ "flat": 0, "freeFrom": 0 }`. |
| `pay` | `{ online, transfer, cod }`, al menos uno `true`. Digital: `cod: false`. |
| `transferInstructions` | Máx. 600. |
| `loyalty` | `{ discount 0–90, freeShipping, threshold }`: % para clientes fieles y compras acumuladas para serlo. |

## products (8 por tienda)

| Campo | Regla |
|---|---|
| `name` | Obligatorio, ≤120. |
| `cat` | Debe estar en `categories`. |
| `price` | Entero ≥0, pesos sin decimales. Terminar en 900 o 000 (59900, 120000). |
| `compare` | `null` o mayor que `price` (si no, la aplicación lo descarta). |
| `stock` | Entero ≥0 o `null` (ilimitado; usar en digitales). |
| `kind` | Ilustración: ver lista abajo. Un valor desconocido se convierte en `box`. |
| `hue` | 0–360, color de la ilustración; varía entre productos. |
| `attrs` | Objeto `{ clave ≤30: valor ≤80 }`, máx. 20. Incluir las `facets` de la tienda. |
| `options` | Máx. 4: `{ name ≤30, values: [≤20 valores ≤30] }`. `[]` si no hay variantes. |
| `desc` | ≤2000. Una o dos frases concretas. |
| `digital` | `true` en productos digitales. |
| `status` | `active` (o `draft` para ocultarlo). |
| `taxRate` | Opcional: 0, 5 o 19 (por defecto 19). |

### Ilustraciones (`kind`)

| kind | Dibujo | kind | Dibujo |
|---|---|---|---|
| `tee` | Camiseta | `headphones` | Audífonos |
| `pants` | Pantalón | `speaker` | Parlante |
| `bag` | Bolso / bolsa | `lamp` | Lámpara |
| `cap` | Gorra | `laptop` | Pantalla |
| `shoe` | Calzado | `keyboard` | Teclado |
| `bottle` | Botella | `cable` | Cable |
| `jar` | Frasco | `play` | Curso en video |
| `box` | Caja (genérico) | `grid` | Plantilla |
| `loaf` | Pan | `cal` | Sesión o cita |
| `dice` | Dados | `doc` | Documento / libro |
| `scroll` | Mapa o pergamino | `sword` | Espada o miniatura |

## promos (4 por tienda)

```json
{ "name": "…", "desc": "…", "kind": "percent", "value": 15, "scope": "Categoría", "code": "", "audience": "all", "min": 0, "endsInDays": 10 }
```

| Campo | Regla |
|---|---|
| `kind` | `percent` (value 1–90), `fixed` (value en pesos), `shipping` (value 0; solo tiendas físicas). |
| `scope` | `all` o el nombre de una categoría. |
| `code` | `""` (automática) o código en mayúsculas sin espacios, único en la tienda. |
| `audience` | `all` o `fiel`. |
| `min` | Compra mínima en pesos. |
| `endsInDays` | Días de vigencia desde que se carga, o `null`. |

Patrón usado en todas las tiendas: promoción de una categoría, bienvenida `PRIMERA10` (10 %, sin fecha),
exclusiva para fieles en otra categoría y una de monto fijo con código o de envío gratis desde un monto.
