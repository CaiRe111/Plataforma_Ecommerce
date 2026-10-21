# Plataforma Ecommerce

Ecommerce para emprendedores y microempresas.

## Fase 1: prototipo visual navegable (`prototype/`)

Maqueta con datos de demostración, sin servidor ni pagos reales.

```
cd prototype && python3 -m http.server 8080   # o abrir prototype/index.html
```

Incluye: tienda (inicio, catálogo con filtros, ficha, carrito, compra en 3 pasos, confirmación),
panel admin (resumen, productos y precios, inventario, pedidos, ajustes) y cuatro tiendas de
ejemplo (moda, alimentos, electrónica, productos digitales). La guía de revisión está en `#/guia`.

## Fase 2 (pendiente de aprobación)

Backend, base de datos, autenticación, pasarela de pagos y gestión real de pedidos.
