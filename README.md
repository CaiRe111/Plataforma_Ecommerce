# Plataforma Ecommerce

Ecommerce para emprendedores y microempresas en Colombia: tienda, panel de administración, pagos con Wompi y facturación electrónica.
Una instalación por cliente, publicada con Cloudflare Tunnel.

| Carpeta | Contenido |
|---|---|
| `app/` | Servidor y tienda (Node 22, SQLite). `npm test` ejecuta las pruebas. |
| `deploy/` | Docker Compose, instalación, respaldos y plantilla de configuración. |
| `docs/` | [Instalación](docs/INSTALL.md) · [Wompi](docs/WOMPI.md) · [DIAN](docs/DIAN.md) · [Arquitectura](docs/ARCHITECTURE.md) |
| `prototype/` | Prototipo visual aprobado en la fase 1 (solo referencia). |

## Probar en local

```bash
cd app
DATA_DIR=./data ADMIN_EMAIL=admin@demo.co ADMIN_PASSWORD=clave-demo-123 npm run seed:demo -- moda --accounts
DATA_DIR=./data ADMIN_EMAIL=admin@demo.co ADMIN_PASSWORD=clave-demo-123 npm start
```

Tienda en `http://localhost:3000`, panel en `http://localhost:3000/#/admin`. Clientes de ejemplo: `valentina.rios@correo.com` (normal) y `mateo.gomez@correo.com` (fiel), contraseña `demo12345`.
Sin llaves de Wompi la tienda ofrece transferencia y contra entrega.

## Estado

- Funcionando y probado: catálogo, carrito, compra, cuentas de cliente normal y fiel, promociones y cupones, panel completo, fotos de producto, inventario con reserva, pedidos, respaldo.
- Pagos con Wompi: implementado y probado con simulaciones; **falta validarlo con llaves de sandbox** (ver docs/WOMPI.md).
- Facturación: infraestructura completa; **el envío a la DIAN depende de elegir el camino** (ver docs/DIAN.md). Hoy emite documentos internos sin validez fiscal.
- Docker y Cloudflare Tunnel: escritos según la documentación, **sin probar** (este entorno no tiene Docker en ejecución).
