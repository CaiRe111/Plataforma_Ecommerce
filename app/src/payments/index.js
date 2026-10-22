import { startPayment as startWompi } from './wompi.js';
import { startDemoPayment } from './demo.js';

/** Inicia un intento de pago con la pasarela configurada (PAYMENT_MODE=demo | wompi). */
export const startOnlinePayment = (db, config, order) => (config.paymentMode === 'wompi' ? startWompi(db, config, order) : startDemoPayment(db, config, order));
