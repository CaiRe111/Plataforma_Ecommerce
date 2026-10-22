// Plantillas de correo. Cada una describe el contenido una sola vez y se genera en texto y en HTML.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cop = n => '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** content: { title, paragraphs[], items?: [{name, detail, qty, total}], totals?: [[label, value]], button?: {label, url}, small? } */
export function render(storeName, content) {
  const text = [
    content.title, '',
    ...content.paragraphs.flatMap(p => [p, '']),
    ...(content.items ? content.items.map(i => `- ${i.name}${i.detail ? ` (${i.detail})` : ''} x${i.qty}: ${cop(i.total)}`).concat(['']) : []),
    ...(content.totals ? content.totals.map(([l, v]) => `${l}: ${v}`).concat(['']) : []),
    ...(content.button ? [`${content.button.label}: ${content.button.url}`, ''] : []),
    ...(content.small ? [content.small, ''] : []),
    `— ${storeName}`,
  ].join('\n');

  const rows = (content.items || []).map(i => `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e8ec">${esc(i.name)}${i.detail ? `<br><span style="color:#667085;font-size:13px">${esc(i.detail)}</span>` : ''}</td><td style="padding:8px 0;border-bottom:1px solid #e6e8ec;text-align:right;white-space:nowrap">×${i.qty} · ${cop(i.total)}</td></tr>`).join('');
  const totals = (content.totals || []).map(([l, v], k, a) => `<tr><td style="padding:4px 0;${k === a.length - 1 ? 'font-weight:700' : 'color:#475467'}">${esc(l)}</td><td style="padding:4px 0;text-align:right;${k === a.length - 1 ? 'font-weight:700' : ''}">${esc(v)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#101828">
<div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#ffffff;border:1px solid #e6e8ec;border-radius:8px;padding:28px">
<p style="margin:0 0 16px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#667085">${esc(storeName)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(content.title)}</h1>
${content.paragraphs.map(p => `<p style="margin:0 0 14px;line-height:1.55">${esc(p)}</p>`).join('')}
${rows ? `<table style="width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:14px">${rows}</table>` : ''}
${totals ? `<table style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:14px">${totals}</table>` : ''}
${content.button ? `<p style="margin:20px 0"><a href="${esc(content.button.url)}" style="background:#214b8a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:700">${esc(content.button.label)}</a></p>` : ''}
${content.small ? `<p style="margin:16px 0 0;font-size:13px;color:#667085;line-height:1.5">${esc(content.small)}</p>` : ''}
</div></div></body></html>`;
  return { text, html };
}

const PAY_COPY = {
  online: 'Tu pedido está reservado. Falta completar el pago en línea; si lo dejaste a medias puedes retomarlo desde el enlace de abajo.',
  transfer: 'Para confirmar tu pedido haz la transferencia con los datos de abajo. Lo preparamos apenas recibamos el pago.',
  cod: 'Pagas en efectivo cuando recibas tu pedido.',
};

/** ctx: { store, order, items, link } */
export function orderContent(kind, { store, order, items, link, note = '' }) {
  const lines = items.map(i => ({ name: i.name, detail: Object.values(JSON.parse(i.opts || '{}')).join(', '), qty: i.qty, total: i.unit_price * i.qty }));
  const totals = [['Subtotal', cop(order.subtotal)]];
  if (order.loyalty_discount) totals.push(['Cliente fiel', '−' + cop(order.loyalty_discount)]);
  if (order.coupon_discount) totals.push([`Cupón ${order.coupon_code}`, '−' + cop(order.coupon_discount)]);
  totals.push(['Envío', order.physical ? (order.shipping ? cop(order.shipping) : 'Gratis') : 'Digital'], ['Total', cop(order.total)]);
  const first = order.name.split(' ')[0];
  const button = { label: 'Ver mi pedido', url: link };
  const base = { items: lines, totals, button };
  switch (kind) {
    case 'order_created':
      return { ...base, title: `Hola, ${first}. Recibimos tu pedido #${order.id}`, paragraphs: [PAY_COPY[order.method], ...(order.method === 'transfer' && store.transferInstructions ? [`Datos para la transferencia: ${store.transferInstructions} Usa el pedido #${order.id} como referencia.`] : [])] };
    case 'payment_confirmed':
      return { ...base, title: `Pago confirmado, ${first}`, paragraphs: [`Recibimos el pago de tu pedido #${order.id}. ${order.physical ? 'Lo estamos preparando y te avisaremos cuando salga.' : 'Ya está confirmado.'}`], small: 'Te enviaremos la factura electrónica cuando esté disponible.' };
    case 'order_shipped':
      return { ...base, title: `Tu pedido #${order.id} va en camino`, paragraphs: [`Enviamos tu pedido a ${order.address}, ${order.city}.`] };
    case 'order_delivered':
      return { ...base, title: order.physical ? `Entregamos tu pedido #${order.id}` : `Tu pedido #${order.id} está completo`, paragraphs: [order.physical ? 'Esperamos que lo disfrutes. Si algo no está bien, responde a este correo.' : 'Marcamos tu compra como entregada. Si necesitas ayuda con el acceso, responde a este correo.'] };
    case 'order_cancelled':
      return { ...base, title: `Cancelamos tu pedido #${order.id}`, paragraphs: [note || 'El pedido fue cancelado.', 'Si ya habías pagado, te contactaremos para gestionar el reembolso.'] };
    default: throw new Error(`Plantilla desconocida: ${kind}`);
  }
}

export const SUBJECT = {
  order_created: (o, s) => `Recibimos tu pedido #${o.id} · ${s}`,
  payment_confirmed: (o, s) => `Pago confirmado · pedido #${o.id} · ${s}`,
  order_shipped: (o, s) => `Tu pedido #${o.id} va en camino · ${s}`,
  order_delivered: (o, s) => `Pedido #${o.id} entregado · ${s}`,
  order_cancelled: (o, s) => `Pedido #${o.id} cancelado · ${s}`,
};

export const welcomeContent = (store, name, url) => ({ title: `Te damos la bienvenida, ${name.split(' ')[0]}`, paragraphs: ['Tu cuenta está lista. Desde ella puedes seguir tus pedidos, guardar tus datos y acceder a los beneficios de cliente fiel.'], button: { label: 'Ir a la tienda', url } });
export const resetContent = (store, name, url) => ({ title: 'Restablece tu contraseña', paragraphs: [`Hola, ${name.split(' ')[0]}. Recibimos una solicitud para cambiar la contraseña de tu cuenta. El enlace sirve una sola vez y vence en una hora.`], button: { label: 'Elegir una contraseña nueva', url }, small: 'Si no fuiste tú, ignora este correo: tu contraseña no cambia.' });
