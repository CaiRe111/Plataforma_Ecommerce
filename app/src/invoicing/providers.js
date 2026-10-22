// Proveedores de facturación. Cada uno recibe el documento del modelo común y devuelve el resultado de emitirlo.
//   issue(doc, ctx) -> { status: 'issued' | 'rejected', cufe?, response? }
//   Si lanza una excepción se considera un fallo transitorio y se reintenta con espera creciente.

const mock = {
  name: 'mock',
  label: 'Documento interno (sin validez fiscal)',
  fiscalValidity: false,
  available: true,
  async issue(doc) {
    return { status: 'issued', cufe: '', response: { note: 'Documento interno de prueba. No fue enviado a la DIAN.', number: doc.fullNumber } };
  },
};

// Aquí se registrarán la conexión directa a la DIAN o el proveedor tecnológico elegido (ver docs/DIAN.md).
const dian = {
  name: 'dian',
  label: 'Conexión directa a la DIAN',
  fiscalValidity: true,
  available: false,
  async issue() { throw new Error('La conexión directa con la DIAN todavía no está implementada.'); },
};

export const PROVIDERS = { mock, dian };
export const getProvider = name => PROVIDERS[name] || mock;
export const listProviders = () => Object.values(PROVIDERS).map(p => ({ name: p.name, label: p.label, fiscalValidity: p.fiscalValidity, available: p.available }));
