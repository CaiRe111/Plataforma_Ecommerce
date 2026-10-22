import path from 'node:path';

const env = process.env;
const bool = (v, d = false) => (v === undefined || v === '' ? d : /^(1|true|yes|si)$/i.test(v));

export function loadConfig(overrides = {}) {
  const publicUrl = (overrides.publicUrl ?? env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const cfg = {
    port: Number(overrides.port ?? env.PORT ?? 3000),
    host: overrides.host ?? env.HOST ?? '0.0.0.0',
    dataDir: path.resolve(overrides.dataDir ?? env.DATA_DIR ?? './data'),
    publicUrl,
    secureCookies: publicUrl.startsWith('https://'),
    // Detrás de Cloudflare Tunnel la IP real llega en CF-Connecting-IP.
    trustProxy: bool(overrides.trustProxy ?? env.TRUST_PROXY, false),
    admin: { email: overrides.adminEmail ?? env.ADMIN_EMAIL ?? '', password: overrides.adminPassword ?? env.ADMIN_PASSWORD ?? '' },
    wompi: {
      env: overrides.wompiEnv ?? env.WOMPI_ENV ?? 'sandbox',
      publicKey: overrides.wompiPublicKey ?? env.WOMPI_PUBLIC_KEY ?? '',
      privateKey: overrides.wompiPrivateKey ?? env.WOMPI_PRIVATE_KEY ?? '',
      eventsSecret: overrides.wompiEventsSecret ?? env.WOMPI_EVENTS_SECRET ?? '',
      integritySecret: overrides.wompiIntegritySecret ?? env.WOMPI_INTEGRITY_SECRET ?? '',
      checkoutUrl: overrides.wompiCheckoutUrl ?? env.WOMPI_CHECKOUT_URL ?? 'https://checkout.wompi.co/p/',
      apiUrl: overrides.wompiApiUrl ?? env.WOMPI_API_URL ?? '',
    },
    // Minutos que se reserva el stock de un pedido pagado en línea antes de liberarlo.
    // demo: pasarela simulada (sin cobros reales). wompi: cobros reales con Wompi.
    paymentMode: (overrides.paymentMode ?? env.PAYMENT_MODE ?? 'demo') === 'wompi' ? 'wompi' : 'demo',
    // outbox: los correos se guardan en el panel y no se envían (demostración). El envío real por SMTP está pendiente.
    mail: { transport: overrides.mailTransport ?? env.MAIL_TRANSPORT ?? 'outbox' },
    reserveMinutes: Number(overrides.reserveMinutes ?? env.RESERVE_MINUTES ?? 45),
    jobsIntervalMs: Number(overrides.jobsIntervalMs ?? env.JOBS_INTERVAL_MS ?? 60_000),
    invoicing: { provider: overrides.invoicingProvider ?? env.INVOICING_PROVIDER ?? 'mock' },
  };
  if (!cfg.wompi.apiUrl) cfg.wompi.apiUrl = cfg.wompi.env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
  cfg.wompi.enabled = cfg.paymentMode === 'wompi' && !!(cfg.wompi.publicKey && cfg.wompi.integritySecret && cfg.wompi.eventsSecret);
  cfg.onlineEnabled = cfg.paymentMode === 'demo' || cfg.wompi.enabled;
  return cfg;
}
