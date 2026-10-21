/* Datos de demostración.
   Cuatro tiendas de rubros distintos sobre la misma estructura, para mostrar
   que el catálogo, los filtros y el flujo de compra se adaptan al negocio. */

const FLOWS = {
  physical: ['pending', 'paid', 'preparing', 'shipped', 'delivered'],
  digital: ['pending', 'paid', 'delivered'],
};

const P = (id, name, cat, price, compare, stock, kind, hue, attrs, options, desc) => ({
  id, name, cat, price, compare, stock, kind, hue, attrs, options: options || [], desc,
  sku: '', status: 'active', digital: false,
});

const DEMO_RAW = {
  moda: {
    rubro: 'Moda', name: 'Taller Norte', hue: 215, type: 'physical', symbol: '$', currency: 'USD',
    tagline: 'Ropa básica de algodón orgánico, hecha en series cortas.',
    hero: { eyebrow: 'Colección otoño', title: 'Básicos que duran más que la temporada.', cta: 'Ver colección' },
    lowStock: 5, shipping: { flat: 6, freeFrom: 80 }, pay: { card: true, transfer: true, cod: true },
    facets: ['Color', 'Material'], cats: ['Camisetas', 'Pantalones', 'Calzado', 'Accesorios'],
    perks: [
      { t: 'Envío gratis desde $80', d: 'Entrega en 2 a 4 días hábiles.' },
      { t: 'Cambios por talla', d: '30 días, sin costo de devolución.' },
      { t: 'Producción local', d: 'Series cortas y sin excedentes.' },
    ],
    products: [
      P('m1', 'Camiseta básica de algodón', 'Camisetas', 24, null, 48, 'tee', 38, { Color: 'Crudo', Material: 'Algodón orgánico' }, [{ name: 'Talla', values: ['S', 'M', 'L', 'XL'] }], 'Corte recto, 180 g/m². Se encoge menos del 2 % después del primer lavado.'),
      P('m2', 'Camiseta de rayas marinas', 'Camisetas', 28, 35, 22, 'tee', 215, { Color: 'Azul marino', Material: 'Algodón orgánico' }, [{ name: 'Talla', values: ['S', 'M', 'L', 'XL'] }], 'Jersey fino con rayas tejidas, no estampadas. Cuello redondo reforzado.'),
      P('m3', 'Pantalón de lino recto', 'Pantalones', 59, null, 14, 'pants', 35, { Color: 'Arena', Material: 'Lino' }, [{ name: 'Talla', values: ['28', '30', '32', '34', '36'] }], 'Lino lavado, tiro medio y botamanga sin dobladillo. Cintura con elástico interno.'),
      P('m4', 'Pantalón cargo', 'Pantalones', 64, null, 3, 'pants', 130, { Color: 'Verde', Material: 'Algodón' }, [{ name: 'Talla', values: ['28', '30', '32', '34', '36'] }], 'Seis bolsillos, tela gabardina resistente al roce. Última tanda de la temporada.'),
      P('m5', 'Tote bag de lona', 'Accesorios', 18, null, 60, 'bag', 45, { Color: 'Crudo', Material: 'Lona' }, [], 'Lona de 12 oz con costuras dobles y bolsillo interior con cierre.'),
      P('m6', 'Gorra de visera curva', 'Accesorios', 16, 20, 0, 'cap', 215, { Color: 'Azul marino', Material: 'Algodón' }, [], 'Seis paneles, cierre metálico ajustable. Bordado en relieve.'),
      P('m7', 'Zapatilla urbana', 'Calzado', 82, null, 9, 'shoe', 8, { Color: 'Blanco', Material: 'Cuero vegano' }, [{ name: 'Talla', values: ['38', '39', '40', '41', '42', '43', '44'] }], 'Suela de caucho reciclado, plantilla acolchada y horma ancha.'),
      P('m8', 'Mochila roll-top', 'Accesorios', 74, null, 11, 'bag', 165, { Color: 'Verde', Material: 'Poliéster reciclado' }, [], 'Capacidad de 22 L, compartimiento acolchado para portátil de 15 pulgadas.'),
    ],
  },

  alimentos: {
    rubro: 'Alimentos', name: 'Casa Maíz', hue: 28, type: 'physical', symbol: '$', currency: 'USD',
    tagline: 'Panadería y despensa artesanal, elaborada cada semana.',
    hero: { eyebrow: 'Hecho esta semana', title: 'Comida de despensa con ingredientes que se pueden leer.', cta: 'Ver productos' },
    lowStock: 5, shipping: { flat: 5, freeFrom: 40 }, pay: { card: true, transfer: true, cod: true },
    facets: ['Dieta', 'Origen'], cats: ['Panadería', 'Despensa', 'Bebidas', 'Regalos'],
    perks: [
      { t: 'Envío gratis desde $40', d: 'Entrega refrigerada cuando el producto lo necesita.' },
      { t: 'Lotes pequeños', d: 'Cada producto indica su fecha de elaboración.' },
      { t: 'Cajas para regalo', d: 'Con tarjeta escrita a mano.' },
    ],
    products: [
      P('a1', 'Pan de masa madre', 'Panadería', 6.5, null, 30, 'loaf', 35, { Dieta: 'Vegano', Origen: 'Local' }, [{ name: 'Tamaño', values: ['Entero', 'Medio'] }], 'Fermentación de 24 horas, corteza gruesa y miga abierta. Se hornea los martes y viernes.'),
      P('a2', 'Granola de avena y miel', 'Despensa', 9, null, 40, 'jar', 45, { Dieta: 'Vegetariano', Origen: 'Local' }, [{ name: 'Presentación', values: ['250 g', '500 g'] }], 'Avena tostada con miel de abejas, almendra y coco. Sin azúcar refinada.'),
      P('a3', 'Mermelada de guayaba', 'Despensa', 7.5, null, 25, 'jar', 350, { Dieta: 'Vegano', Origen: 'Local' }, [], 'Fruta, azúcar de caña y limón. Frasco de vidrio de 280 g.'),
      P('a4', 'Café de origen', 'Bebidas', 14, null, 18, 'bag', 25, { Dieta: 'Vegano', Origen: 'Nacional' }, [{ name: 'Molienda', values: ['Grano', 'Molido medio', 'Molido fino'] }], 'Bolsa de 340 g. Tueste medio con notas de panela y cacao.'),
      P('a5', 'Kombucha de jengibre', 'Bebidas', 4.5, null, 4, 'bottle', 90, { Dieta: 'Vegano', Origen: 'Local' }, [], 'Botella de 330 ml, fermentada 12 días. Se conserva refrigerada.'),
      P('a6', 'Caja degustación', 'Regalos', 38, 45, 12, 'box', 20, { Dieta: 'Vegetariano', Origen: 'Local' }, [], 'Granola, mermelada, café y galletas en una caja reutilizable.'),
      P('a7', 'Galletas sin gluten', 'Panadería', 8, null, 20, 'box', 55, { Dieta: 'Sin gluten', Origen: 'Local' }, [], 'Harina de arroz y almendra. Caja de 12 unidades.'),
      P('a8', 'Aceite de oliva extra virgen', 'Despensa', 16, null, 15, 'bottle', 100, { Dieta: 'Vegano', Origen: 'Importado' }, [{ name: 'Presentación', values: ['500 ml', '1 L'] }], 'Primera presión en frío. Botella oscura que protege el aceite de la luz.'),
    ],
  },

  tecnologia: {
    rubro: 'Electrónica', name: 'Voltio', hue: 262, type: 'physical', symbol: '$', currency: 'USD',
    tagline: 'Accesorios y hogar conectado con garantía local.',
    hero: { eyebrow: 'Garantía de 12 meses', title: 'Tecnología útil, sin complicarte la vida.', cta: 'Explorar catálogo' },
    lowStock: 5, shipping: { flat: 8, freeFrom: 100 }, pay: { card: true, transfer: true, cod: false },
    facets: ['Marca', 'Conexión'], cats: ['Audio', 'Hogar', 'Computación', 'Accesorios'],
    perks: [
      { t: 'Garantía de 12 meses', d: 'Reposición directa si el equipo falla.' },
      { t: 'Soporte por WhatsApp', d: 'Respondemos en menos de 2 horas hábiles.' },
      { t: 'Envío gratis desde $100', d: 'Con seguimiento del paquete.' },
    ],
    products: [
      P('t1', 'Audífonos inalámbricos Aura', 'Audio', 89, 109, 25, 'headphones', 262, { Marca: 'Aura', Conexión: 'Bluetooth' }, [{ name: 'Color', values: ['Negro', 'Blanco'] }], 'Cancelación de ruido activa y 30 horas de batería. Estuche de carga incluido.'),
      P('t2', 'Parlante portátil Cubo', 'Audio', 59, null, 14, 'speaker', 200, { Marca: 'Cubo', Conexión: 'Bluetooth' }, [{ name: 'Color', values: ['Gris', 'Azul'] }], 'Resistente al agua IPX7, 12 horas de reproducción y micrófono integrado.'),
      P('t3', 'Lámpara inteligente', 'Hogar', 29, 40, 50, 'lamp', 50, { Marca: 'Luma', Conexión: 'Wi-Fi' }, [], 'Luz blanca cálida a fría y 16 millones de colores. Funciona con asistentes de voz.'),
      P('t4', 'Enchufe inteligente (2 unidades)', 'Hogar', 22, null, 4, 'box', 120, { Marca: 'Luma', Conexión: 'Wi-Fi' }, [], 'Programa horarios y mide el consumo. Máximo 10 A por enchufe.'),
      P('t5', 'Teclado mecánico compacto', 'Computación', 79, null, 8, 'keyboard', 300, { Marca: 'Tecla', Conexión: 'USB-C' }, [{ name: 'Interruptor', values: ['Lineal', 'Táctil'] }], 'Formato 75 %, hot-swap y retroiluminación blanca. Cable USB-C desmontable.'),
      P('t6', 'Monitor 24" Full HD', 'Computación', 169, null, 6, 'laptop', 215, { Marca: 'Pantal', Conexión: 'HDMI' }, [], 'Panel IPS de 75 Hz, bordes finos y base ajustable en altura.'),
      P('t7', 'Cargador GaN 65 W', 'Accesorios', 34, 70, 36, 'box', 150, { Marca: 'Voltio', Conexión: 'USB-C' }, [], 'Carga un portátil y un teléfono a la vez. Mitad del tamaño de un cargador común.'),
      P('t8', 'Cable USB-C trenzado de 2 m', 'Accesorios', 12, null, 120, 'cable', 330, { Marca: 'Voltio', Conexión: 'USB-C' }, [{ name: 'Color', values: ['Negro', 'Gris'] }], 'Soporta 100 W y transferencia de datos de 480 Mbps. Resistente a 10 000 dobleces.'),
    ],
  },

  digital: {
    rubro: 'Productos digitales', name: 'Estudio Lumen', hue: 168, type: 'digital', symbol: '$', currency: 'USD',
    tagline: 'Cursos, plantillas y asesorías de fotografía para trabajar por tu cuenta.',
    hero: { eyebrow: 'Aprende a tu ritmo', title: 'Fotografía que se aprende haciendo.', cta: 'Ver cursos y recursos' },
    lowStock: 3, shipping: { flat: 0, freeFrom: 0 }, pay: { card: true, transfer: true, cod: false },
    facets: ['Formato', 'Nivel'], cats: ['Cursos', 'Plantillas', 'Asesorías', 'Libros'],
    perks: [
      { t: 'Acceso inmediato', d: 'Recibes el enlace en tu correo al confirmar el pago.' },
      { t: 'Acceso de por vida', d: 'Incluye las actualizaciones futuras.' },
      { t: 'Garantía de 14 días', d: 'Si no te sirve, te devolvemos el pago.' },
    ],
    products: [
      P('d1', 'Curso: fotografía con el móvil', 'Cursos', 49, 79, null, 'play', 280, { Formato: 'Video', Nivel: 'Principiante' }, [], '32 lecciones en video sobre luz, encuadre y edición. Ejercicios con corrección.'),
      P('d2', 'Curso: edición en Lightroom', 'Cursos', 69, null, null, 'play', 200, { Formato: 'Video', Nivel: 'Intermedio' }, [], 'Flujo de trabajo completo, de la importación a la entrega al cliente.'),
      P('d3', 'Pack de 40 presets', 'Plantillas', 25, 35, null, 'grid', 320, { Formato: 'Archivo', Nivel: 'Todos' }, [{ name: 'Licencia', values: ['Personal', 'Comercial'] }], 'Presets para retrato, paisaje y producto. Compatibles con Lightroom móvil y escritorio.'),
      P('d4', 'Plantilla de portafolio web', 'Plantillas', 39, null, null, 'grid', 160, { Formato: 'Archivo', Nivel: 'Intermedio' }, [{ name: 'Licencia', values: ['Personal', 'Comercial'] }], 'Plantilla editable de una página, con galería y formulario de contacto.'),
      P('d5', 'Asesoría 1:1 de 60 minutos', 'Asesorías', 45, null, 6, 'cal', 20, { Formato: 'Sesión en vivo', Nivel: 'Todos' }, [{ name: 'Modalidad', values: ['Videollamada'] }], 'Sesión individual por videollamada. Los cupos se agendan después del pago.'),
      P('d6', 'Revisión de portafolio', 'Asesorías', 30, null, 2, 'cal', 40, { Formato: 'Sesión en vivo', Nivel: 'Intermedio' }, [], 'Recibes comentarios por escrito sobre 15 fotografías en 3 días hábiles.'),
      P('d7', 'Guía de iluminación (ebook)', 'Libros', 12, null, null, 'doc', 180, { Formato: 'PDF', Nivel: 'Principiante' }, [], '64 páginas con esquemas de luz natural y artificial.'),
      P('d8', 'Libro: composición visual', 'Libros', 18, 22, null, 'doc', 300, { Formato: 'PDF', Nivel: 'Intermedio' }, [], '120 páginas con análisis de 50 fotografías y ejercicios.'),
    ],
  },
};

/* ---------- generación de pedidos de ejemplo ---------- */

const DEMO_PEOPLE = [
  ['Valentina Ríos', 'valentina.rios@correo.com'], ['Mateo Gómez', 'mateo.gomez@correo.com'],
  ['Camila Torres', 'camila.t@correo.com'], ['Andrés Rojas', 'andres.rojas@correo.com'],
  ['Sofía Herrera', 'sofia.herrera@correo.com'], ['Julián Castro', 'julian.castro@correo.com'],
  ['Laura Mejía', 'laura.mejia@correo.com'], ['Daniel Pardo', 'daniel.pardo@correo.com'],
  ['Isabela Ortiz', 'isabela.ortiz@correo.com'], ['Sebastián Vega', 'sebastian.vega@correo.com'],
];
const DEMO_STREETS = ['Calle 45 #12-30', 'Carrera 7 #84-12', 'Av. Circunvalar 22-18', 'Calle 10 #5-60', 'Carrera 43A #1-50', 'Transversal 18 #96-41'];
const DEMO_CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga'];

function calcShipping(store, afterDiscount, physical) {
  if (!physical) return 0;
  return afterDiscount >= store.shipping.freeFrom ? 0 : store.shipping.flat;
}

function genOrders(store, seed) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const flow = FLOWS[store.type];
  const methods = ['card', 'transfer', 'cod'].filter(m => store.pay[m]);
  const now = Date.now();
  const raw = [];
  for (let i = 0; i < 26; i++) {
    const daysAgo = Math.floor(Math.pow(rnd(), 1.3) * 14);
    raw.push({ at: now - daysAgo * 864e5 - Math.floor(rnd() * 20) * 36e5, daysAgo });
  }
  raw.sort((a, b) => a.at - b.at);
  return raw.map((r, idx) => {
    const n = 1 + Math.floor(rnd() * 3);
    const items = [];
    for (let k = 0; k < n; k++) {
      const p = pick(store.products);
      if (items.some(x => x.pid === p.id)) continue;
      const opts = {};
      p.options.forEach(o => { opts[o.name] = pick(o.values); });
      items.push({ pid: p.id, name: p.name, qty: 1 + (rnd() < 0.25 ? 1 : 0), price: p.price, opts, digital: p.digital });
    }
    const subtotal = items.reduce((a, x) => a + x.price * x.qty, 0);
    const physical = items.some(x => !x.digital);
    const ship = calcShipping(store, subtotal, physical);
    const person = pick(DEMO_PEOPLE);
    let status;
    const d = r.daysAgo, roll = rnd();
    if (roll < 0.07) status = 'cancelled';
    else if (store.type === 'digital') status = d <= 1 ? pick(['pending', 'paid']) : d <= 2 ? 'paid' : 'delivered';
    else if (d <= 1) status = pick(['pending', 'paid']);
    else if (d <= 3) status = pick(['paid', 'preparing']);
    else if (d <= 6) status = pick(['preparing', 'shipped']);
    else status = 'delivered';
    const history = [{ s: 'pending', at: new Date(r.at).toISOString() }];
    if (status === 'cancelled') history.push({ s: 'cancelled', at: new Date(Math.min(now, r.at + 5 * 36e5)).toISOString() });
    else flow.slice(1, flow.indexOf(status) + 1).forEach((st, k) => history.push({ s: st, at: new Date(Math.min(now, r.at + (k + 1) * 9 * 36e5)).toISOString() }));
    return {
      id: String(1001 + idx), date: new Date(r.at).toISOString(),
      customer: { name: person[0], email: person[1], phone: '3' + String(100000000 + Math.floor(rnd() * 89999999)) },
      address: physical ? { line: pick(DEMO_STREETS), city: pick(DEMO_CITIES) } : null,
      items, subtotal, discount: 0, shipping: ship, total: subtotal + ship,
      method: pick(methods), status, history,
    };
  });
}

function buildDemo() {
  const stores = {};
  let seed = 7;
  Object.keys(DEMO_RAW).forEach(key => {
    const st = JSON.parse(JSON.stringify(DEMO_RAW[key]));
    st.products.forEach((p, i) => {
      p.sku = key.slice(0, 2).toUpperCase() + '-' + (1001 + i);
      if (st.type === 'digital') p.digital = true;
    });
    st.orders = genOrders(st, (seed += 31));
    st.cart = { items: [], coupon: null };
    stores[key] = st;
  });
  return stores;
}
