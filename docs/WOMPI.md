# Pagos con Wompi

> **Estado: apagado en la demostración.** Por defecto la tienda usa una **pasarela simulada** (`PAYMENT_MODE=demo`): el cliente elige si el pago se aprueba, se rechaza o queda pendiente y no se cobra nada. El resto del flujo (pedido pagado, inventario, factura, correos) es el mismo que con Wompi.
> Esta guía describe la integración real, que se activa con `PAYMENT_MODE=wompi` y las llaves del cliente.

## Cómo funciona

1. El cliente confirma el pedido. El servidor **recalcula todo** (precios, promociones, envío), reserva el inventario y crea el pedido en estado *Pendiente de pago*.
2. El servidor firma el pago (firma de integridad) y envía al cliente al checkout de Wompi con el monto, la referencia y la dirección de retorno.
3. Wompi cobra y avisa por **webhook** a `https://TU-DOMINIO/api/webhooks/wompi`. El servidor valida el checksum del evento, comprueba que monto y moneda coinciden con el pedido y marca el pedido como pagado (una sola vez, aunque el evento llegue repetido).
4. El cliente vuelve a `/pago/retorno`, que lo lleva a la página de su pedido. Esa página consulta a Wompi el estado real de la transacción, así que no depende de que el webhook haya llegado primero.
5. Un proceso cada minuto cancela los pedidos en línea que nunca se pagaron (`RESERVE_MINUTES`, 45 por defecto) y devuelve el inventario. Antes de cancelar consulta a Wompi, por si el pago se aprobó y el webhook se perdió. Los pagos que siguen en `PENDING` (PSE, Nequi) esperan hasta 24 horas.

Un pago aprobado genera la factura electrónica (ver [DIAN.md](DIAN.md)).

## Configuración (por cliente)

1. En Wompi, con la cuenta del cliente, abre **Desarrolladores** y copia: llave pública, **secreto de integridad** y **secreto de eventos**.
   Al empezar usa las llaves de *sandbox* (`pub_test_…`).
2. Pégalas en `deploy/.env`: `PAYMENT_MODE=wompi`, `WOMPI_ENV=sandbox`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`. Reinicia: `docker compose up -d`.
3. En Wompi → Desarrolladores → **URL de eventos**, pon la que muestra el panel en *Ajustes → Pagos* (`https://tienda.cliente.com/api/webhooks/wompi`). Hay una URL por ambiente (sandbox y producción).
4. Para pasar a producción cambia `WOMPI_ENV=production` y las tres llaves por las de producción, y configura la URL de eventos del ambiente de producción.

La llave privada no se usa: la integración no necesita ejecutar acciones con ella.

## Qué está verificado y qué no

Este entorno de desarrollo no tiene acceso al sitio de documentación de Wompi ni a su API, así que **la integración no se ha probado contra Wompi real**.
Se implementó según lo que la documentación pública indica y está cubierta por pruebas automáticas que simulan a Wompi:

- Firma de integridad: SHA-256 de `referencia + monto en centavos + moneda + secreto de integridad`.
- Checksum de eventos: SHA-256 de los valores de `signature.properties` (en ese orden) + `timestamp` + secreto de eventos, comparado con `signature.checksum` y el encabezado `X-Event-Checksum`.
- Estados: `PENDING`, `APPROVED`, `DECLINED`, `VOIDED`, `ERROR`.
- Checkout web en `https://checkout.wompi.co/p/` con `public-key`, `currency`, `amount-in-cents`, `reference`, `signature:integrity`, `redirect-url`.
- API: `GET /v1/transactions/{id}` y `GET /v1/transactions?reference=…` (sandbox `https://sandbox.wompi.co/v1`, producción `https://production.wompi.co/v1`).

### Pruebas que hay que hacer con llaves de sandbox antes de vender

| Prueba | Resultado esperado |
|---|---|
| Pago aprobado con tarjeta de prueba | Pedido pasa a *Pagado* y aparece la factura en cola |
| Pago rechazado | Pedido sigue *Pendiente*, el cliente puede pagar de nuevo desde su pedido |
| PSE o Nequi (quedan pendientes y luego se aprueban) | El pedido se actualiza solo en la página del pedido |
| Cerrar la ventana de Wompi sin pagar | A los 45 minutos el pedido se cancela y vuelve el inventario |
| Reenviar el mismo evento desde el panel de Wompi | No se duplica nada |
| Volver desde Wompi (`/pago/retorno`) | Llega a la página del pedido con el estado correcto |

Puntos que podrían requerir un ajuste menor al probar: nombres de los parámetros opcionales del checkout (`customer-data:email`, `customer-data:full-name`),
el formato exacto de la respuesta de `GET /transactions?reference=`, y el monto mínimo que acepta Wompi.

## Reembolsos

Cancelar un pedido pagado en la tienda **no devuelve el dinero**: el reembolso se hace desde el panel de Wompi. La tienda lo avisa al cancelar.
