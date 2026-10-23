# Plataforma Ecommerce

Ecommerce para emprendedores y microempresas en Colombia: tienda, panel de administración, pagos con Wompi y facturación electrónica.
Una instalación por cliente, publicada con Cloudflare Tunnel.

| Carpeta | Contenido |
|---|---|
| `app/` | Servidor y tienda (Node 22, SQLite). `npm test` ejecuta las pruebas. |
| `deploy/` | Docker Compose, instalación, respaldos y plantilla de configuración. |
| `docs/` | [Instalación](docs/INSTALL.md) · [Wompi](docs/WOMPI.md) · [DIAN](docs/DIAN.md) · [Arquitectura](docs/ARCHITECTURE.md) |
| `demo/` | Empaqueta la tienda y su servidor para que corran completos en el navegador (demo publicable). `cd demo && npm install && npm run build` genera `dist/demo.html`. |
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

- Temas visuales por cliente: **Clásico** (minimalista, por defecto) y **Fantasía** (pergamino, marcos dorados, tipografía medieval), que se elige en Ajustes y solo cambia la tienda; el panel siempre es sobrio. Para verlo: `npm run seed:demo -- fantasia --accounts`.
- Funcionando y probado: catálogo, carrito, compra, cuentas de cliente normal y fiel, promociones y cupones, panel completo, fotos de producto, inventario con reserva, pedidos, respaldo.
- Pagos: en la demostración usan una **pasarela simulada** (aprobado, rechazado o pendiente; no se cobra nada). Wompi está implementado y probado con simulaciones, apagado, y **falta validarlo con llaves de sandbox** (docs/WOMPI.md).
- Facturación: infraestructura completa; **el envío a la DIAN depende de elegir el camino** (ver docs/DIAN.md). Hoy emite documentos internos sin validez fiscal.
- Correo transaccional: plantillas y recuperación de contraseña funcionando; en la demostración los correos se guardan en el panel (Correos) y no se envían. Falta el transporte SMTP.
- Docker y Cloudflare Tunnel: escritos según la documentación, **sin probar** (este entorno no tiene Docker en ejecución).
