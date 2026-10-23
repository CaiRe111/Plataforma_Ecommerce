// Se ejecuta antes que todo el código empaquetado: entorno mínimo para que el servidor corra en el navegador.
import { Buffer } from 'buffer';
const toString = Buffer.prototype.toString;
Buffer.prototype.toString = function (enc, start, end) {
  if (enc === 'base64url') return toString.call(this, 'base64', start, end).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return toString.call(this, enc, start, end);
};
globalThis.Buffer = Buffer;
globalThis.process = globalThis.process || { env: {}, argv: [] };
globalThis.process.env = globalThis.process.env || {};
