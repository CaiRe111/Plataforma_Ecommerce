# Instalación en el servidor de un cliente

Una instalación = un servidor del cliente + un túnel de Cloudflare + una carpeta `deploy/` con su propio `.env`.
El dominio lo administras tú desde tu cuenta de Cloudflare; el servidor del cliente no abre ningún puerto.

```
Cliente (navegador) ──HTTPS──> Cloudflare (tu cuenta) ──túnel──> cloudflared ──> app:3000 ──> SQLite (/data)
Wompi ──HTTPS (webhook)──────────────────────────────────────────────────────────┘
```

## Requisitos del servidor del cliente

- Linux con Docker y el plugin `docker compose` (recomendado), o cualquier equipo con Node 22.13 o superior.
- Salida a internet (HTTPS). No necesita IP pública ni puertos abiertos.
- Espacio: unos cientos de MB más las fotos de productos.

## 1. Cloudflare (en tu cuenta, una vez por cliente)

1. El dominio del cliente (o un subdominio tuyo, por ejemplo `cliente.tudominio.com`) debe estar en tu cuenta de Cloudflare.
2. Zero Trust → Redes → Túneles → **Crear un túnel** → tipo *Cloudflared* → ponle el nombre del cliente.
3. Copia el **token** del túnel (lo vas a poner en `TUNNEL_TOKEN`). No ejecutes el comando que muestra la página; lo hace Docker.
4. En la pestaña *Public Hostname* agrega: dominio `tienda.cliente.com`, servicio **HTTP**, URL `app:3000`.
   Cloudflare crea el registro DNS solo.
5. Recomendado en el dominio:
   - SSL/TLS en modo *Full*; activa *Always Use HTTPS*.
   - Regla WAF de limitación de tasa para `/api/admin/login` y `/api/auth/*` (por ejemplo 20 solicitudes por minuto por IP).
   - **Importante:** si usas *Bot Fight Mode* o reglas WAF estrictas, crea una excepción para la ruta `/api/webhooks/wompi`;
     si Cloudflare bloquea a Wompi, los pagos aprobados no llegan a la tienda.

## 2. Servidor del cliente

```bash
git clone <repositorio> tienda && cd tienda/deploy
./install.sh                 # la primera vez crea .env y se detiene
nano .env                    # PUBLIC_URL, ADMIN_EMAIL, TUNNEL_TOKEN y llaves de Wompi
./install.sh                 # construye, arranca y espera a que la tienda responda
```

- Si `ADMIN_PASSWORD` está vacío, el script genera una y la muestra una sola vez.
- Abre `https://tienda.cliente.com/#/admin`, entra y **cambia la contraseña** en Ajustes. Después puedes borrar `ADMIN_PASSWORD` del `.env`.

## 3. Configurar la tienda (panel de administración)

1. **Ajustes**: nombre, color, tipo de negocio (físico o digital), envío, métodos de pago.
2. **Productos**: crea productos, sube fotos y define precios con IVA incluido y la tarifa de IVA de cada uno.
3. **Promociones** y **Clientes**: descuentos, cupones y reglas del programa de cliente fiel.
4. **Facturación**: datos del emisor y resolución de numeración. Ver [DIAN.md](DIAN.md).
5. **Wompi**: ver [WOMPI.md](WOMPI.md).

Para probar con datos de ejemplo en una instalación vacía (no lo uses en producción):

```bash
docker compose exec app node --disable-warning=ExperimentalWarning src/seed/index.js moda --accounts
```

## 4. Respaldos

La base de datos es un solo archivo (`/data/app.db`) más la carpeta `/data/uploads` con las fotos.

```bash
./backup.sh /ruta/de/respaldos            # copia consistente, conserva las 14 más recientes
```

Prográmalo cada noche con cron: `17 3 * * *  cd /ruta/tienda/deploy && ./backup.sh /ruta/respaldos`.
Copia esa carpeta fuera del servidor (otro disco o almacenamiento en la nube): un respaldo en el mismo equipo no protege de un fallo del disco.

**Restaurar:** detén la tienda (`docker compose stop app`), copia `app.db` y `uploads/` del respaldo al volumen
(`docker compose cp RESPALDO/app.db app:/data/app.db`), y arranca de nuevo (`docker compose start app`).

## 5. Actualizar

```bash
cd tienda && git pull && cd deploy && docker compose up -d --build
```

Las migraciones de la base de datos se aplican solas al arrancar. Haz un respaldo antes de actualizar.

## 6. Sin Docker (alternativa)

1. Instala Node 22.13 o superior y [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) como servicio del sistema con `TUNNEL_TOKEN`.
2. En el Public Hostname del túnel usa la URL `http://localhost:3000`.
3. Desde `app/`: `PUBLIC_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… DATA_DIR=/var/lib/tienda TRUST_PROXY=true npm start`.
4. Para que arranque con el equipo usa systemd (Linux) o el Programador de tareas (Windows).

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `PUBLIC_URL` | Dirección pública con https. Cookies seguras, retorno de Wompi, URL de eventos. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Administrador inicial (solo se usa si aún no existe ninguno). |
| `TUNNEL_TOKEN` | Token del túnel de Cloudflare. |
| `WOMPI_ENV`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Pagos en línea. Sin ellas la tienda funciona con transferencia o contra entrega. |
| `RESERVE_MINUTES` | Minutos que se reserva el inventario de un pago en línea sin completar (45 por defecto). |
| `TRUST_PROXY` | `true` detrás de Cloudflare para leer la IP real del cliente (ya viene activado en el compose). |
| `DATA_DIR` | Carpeta de datos (`/data` en Docker). |

## Qué revisar si algo falla

- `docker compose logs app` y `docker compose logs tunnel`.
- La tienda carga pero el pago no se confirma: revisa la URL de eventos en Wompi y la regla WAF de Cloudflare (ver arriba).
- No puedo iniciar sesión en el panel: `PUBLIC_URL` debe ser exactamente la dirección con la que entras (con https), si no el navegador no guarda la cookie segura.
