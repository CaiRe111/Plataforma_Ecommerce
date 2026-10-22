# Plataforma Ecommerce

Ecommerce para emprendedores y microempresas.

## Fase 1: prototipo visual navegable (`prototype/`)

Maqueta con datos de demostración, sin servidor ni pagos reales.

```
cd prototype && python3 -m http.server 8080   # o abrir prototype/index.html
```

Decisiones: Colombia, precios en COP con IVA incluido, una instalación por cliente.

Incluye:
- Tienda: inicio, catálogo con filtros, ficha, carrito, compra en 3 pasos (tarjeta, PSE, transferencia, contra entrega), confirmación.
- Zona de ofertas (`#/ofertas`): promociones automáticas, cupones, precios exclusivos.
- Perfiles de cliente: **normal** y **fiel** (descuento permanente, envío gratis, promociones exclusivas). Cambia de perfil en la barra superior o en `#/cuenta`.
- Panel admin: resumen, productos y precios, inventario, pedidos, clientes (reglas del programa fiel), promociones, ajustes.
- Cuatro negocios de ejemplo (moda, alimentos, electrónica, productos digitales) sobre la misma base.

La guía de revisión está en `#/guia`.

## Fase 2 (pendiente de aprobación)

Backend, base de datos, autenticación, pasarela de pagos y gestión real de pedidos.
