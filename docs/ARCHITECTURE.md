# Arquitectura

## Decisiones

| Decisión | Motivo |
|---|---|
| Una instalación por cliente | Datos, dominio y configuración aislados; sin multi-inquilino que complique la seguridad |
| Node 22 sin dependencias externas | Menos que instalar, actualizar y auditar en cada servidor; sin compilaciones nativas |
| SQLite (`node:sqlite`, modo WAL) | Un archivo por cliente: respaldo y restauración triviales; sobra para una microempresa |
| Interfaz en el mismo servidor | Un solo proceso que desplegar; fuentes e imágenes locales, sin CDN |
| Cloudflare Tunnel | El servidor del cliente no expone puertos; el dominio queda en tu cuenta |
| El servidor es la autoridad de precios | El navegador solo muestra; `src/shared/pricing.js` lo usan ambos y el servidor recalcula al comprar |

## Componentes

```
app/
  src/
    server.js            HTTP, rutas estáticas, seguridad, tareas periódicas
    routes.js            API pública (/api/*) y de administración (/api/admin/*)
    auth.js              scrypt, sesiones (cookie HttpOnly, token con hash en BD)
    db/                  migraciones numeradas y transacciones anidables
    domain/              ajustes, catálogo, promociones, clientes, pedidos
    shared/pricing.js    precios, promociones, cupones, fiel, envío (puro, compartido con el navegador)
    payments/wompi.js    firma, checkout, webhook, consulta y expiración
    invoicing/           documento, numeración, cola y proveedores
    seed/, backup.js     datos de ejemplo y respaldo
  public/                tienda y panel (SPA con rutas por #/)
  test/                  33 pruebas (precios, Wompi, pedidos, facturación)
deploy/                  compose, instalación, respaldos
```

## Flujo de un pedido en línea

```mermaid
sequenceDiagram
  participant C as Cliente
  participant S as Servidor
  participant W as Wompi
  C->>S: POST /api/orders (carrito, datos, método)
  S->>S: recalcula, valida, reserva stock, crea pedido (pendiente)
  S-->>C: URL de checkout firmada
  C->>W: paga (tarjeta, PSE, Nequi…)
  W->>S: webhook transaction.updated (checksum)
  S->>S: valida firma, monto y moneda; marca pagado; encola factura
  W-->>C: redirige a /pago/retorno?id=…
  C->>S: página del pedido consulta el estado real
```

## Seguridad

- Contraseñas con scrypt y sal; sesiones aleatorias de 256 bits guardadas como hash; cookies `HttpOnly`, `SameSite=Lax` y `Secure` con https.
- Mutaciones solo con JSON y comprobación de origen; límites de intentos en acceso, registro y pedidos.
- Cabeceras: CSP estricta (solo recursos propios), `nosniff`, `X-Frame-Options: DENY`.
- Pedidos de invitados se consultan con un enlace con token secreto; los de clientes, con su sesión.
- Las llaves de Wompi viven solo en variables de entorno; los secretos fiscales no se devuelven al navegador.
- Subida de fotos: tipo y firma del archivo verificados, 3 MB máximo, nombre generado por el servidor.

## Límites conocidos

- Un solo proceso y una sola base: suficiente para miles de pedidos al día, no para alta concurrencia.
- Sin correo electrónico: no hay confirmaciones por correo, verificación de correo ni recuperación de contraseña (el administrador puede cambiar la suya; un cliente que la olvide necesita ayuda manual).
- Una foto por producto, sin devoluciones ni notas crédito, sin cálculo de transportadoras.
- La limitación de intentos vive en memoria: se reinicia con el servidor (Cloudflare añade la capa principal).
