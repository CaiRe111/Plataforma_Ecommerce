# Facturación electrónica (DIAN)

## Estado actual

**Implementado y probado** (todo lo que rodea al envío):

- Datos del emisor (NIT, razón social, dirección, código DANE, régimen, ambiente) en *Facturación*.
- Datos del comprador en el checkout: tipo y número de documento (CC, NIT, CE, pasaporte, TI o consumidor final).
- IVA por producto (0 %, 5 % o 19 %) con precios que ya lo incluyen; el IVA del envío es configurable. Los descuentos se reparten entre las líneas.
- Resoluciones de numeración (rango, vigencia, prefijo, clave técnica) con numeración consecutiva, avisos de agotamiento o vencimiento y bloqueo si no hay una vigente.
- Cola de facturas: cada pedido pagado genera una factura; si falla se reintenta con espera creciente conservando el mismo número; se puede reintentar a mano y encolar pedidos anteriores.
- Modelo de documento común (líneas, bases, impuestos por tarifa, totales) y una interfaz de proveedor.

**Pendiente: el envío real a la DIAN.** Hoy el único proveedor disponible es de prueba: genera un documento interno que la pantalla marca como *sin validez fiscal*. Ninguna factura se transmite a la DIAN.

## Decisión

Se eligió el **camino A: proveedor tecnológico autorizado por la DIAN**. Falta elegir el proveedor (ver abajo); el adaptador se escribe cuando se tenga su documentación y un usuario de pruebas.

Criterios para elegirlo: que figure como proveedor autorizado en el listado vigente de la DIAN; API REST con ambiente de pruebas; emisión de facturas y notas crédito; entrega de XML y PDF; webhooks o consulta de estado; costo por documento o plan mensual; y que el cliente pueda contratarlo directamente.

## Por qué falta y qué hay que decidir

Hay dos caminos para emitir facturas con validez fiscal:

| | A. Proveedor tecnológico autorizado | B. Conexión directa (software propio) |
|---|---|---|
| Quién hace el XML UBL 2.1, la firma, el CUFE, el envío y el PDF | El proveedor, por API | Esta plataforma |
| Lo que necesita el cliente | Contrato con el proveedor | Habilitación propia ante la DIAN (set de pruebas), certificado de firma digital, representación gráfica en PDF con QR, conservación 5 años |
| Esfuerzo y riesgo | Bajo: se escribe un adaptador de API | Alto: hay que seguir exactamente los anexos técnicos y actualizarlos cuando cambian; un error genera rechazos de la DIAN |
| Costo | Pago por documento o plan mensual | Sin costo por documento, con mantenimiento propio |

**Recomendación:** empezar por el camino A con el primer cliente y dejar el B para cuando el volumen justifique el mantenimiento.
No implementé el camino B de memoria: no pude consultar el anexo técnico vigente desde este entorno y una factura mal formada tiene consecuencias legales y operativas para el cliente.

### Lo que necesito para continuar

1. **El proveedor** (con acceso a su documentación de API y un usuario de pruebas). Cada proveedor tiene su propia API; el adaptador se escribe en `app/src/invoicing/providers.js` y recibe el documento ya calculado.
2. Del cliente: NIT, razón social, dirección y código DANE, régimen y tarifas de IVA de sus productos, resolución de numeración (o set de pruebas de habilitación), y cómo trata las ventas a consumidor final.
3. Si el camino es B: certificado de firma digital (.p12 y su clave), ID y PIN del software registrado y el ID del set de pruebas.

## Cómo se conecta un proveedor

```js
// app/src/invoicing/providers.js
const miProveedor = {
  name: 'mi-proveedor', label: 'Mi proveedor', fiscalValidity: true, available: true,
  async issue(doc, { fiscal }) {
    // doc: número, fecha, emisor, comprador, líneas, impuestos y totales (ver invoicing/document.js)
    // Éxito:        return { status: 'issued', cufe, response }
    // Rechazo DIAN: return { status: 'rejected', response }          (no se reintenta solo)
    // Fallo de red: throw new Error('…')                              (se reintenta con espera creciente)
  },
};
```

## Pendiente también

- Notas crédito para devoluciones y cancelaciones de pedidos ya facturados (el modelo de datos ya las contempla).
- Envío del PDF y el XML al correo del cliente (requiere correo transaccional).
- Confirmar con el contador del cliente: tratamiento del IVA del envío, productos excluidos o exentos y ventas a consumidor final.

Esta documentación describe el software, no es asesoría tributaria.
