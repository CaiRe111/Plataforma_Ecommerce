#!/usr/bin/env bash
# Instalación en el servidor del cliente (Linux con Docker). Uso: ./install.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Falta Docker. Instálalo desde https://docs.docker.com/engine/install/ y vuelve a ejecutar."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Falta el plugin 'docker compose'."; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó deploy/.env. Complétalo (PUBLIC_URL, ADMIN_EMAIL, TUNNEL_TOKEN y las llaves de Wompi) y vuelve a ejecutar este script."
  exit 0
fi

set -a; . ./.env; set +a
for v in PUBLIC_URL ADMIN_EMAIL TUNNEL_TOKEN; do
  [ -n "${!v:-}" ] || { echo "Falta $v en deploy/.env"; exit 1; }
done
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  GEN=$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-16)
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$GEN|" .env
  echo "Contraseña inicial del administrador: $GEN  (cámbiala desde Ajustes al entrar)"
fi

docker compose up -d --build
echo "Esperando a que la tienda responda…"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "Listo. Abre $PUBLIC_URL (administración: $PUBLIC_URL/#/admin)."; exit 0
  fi
  sleep 2
done
echo "La tienda no respondió a tiempo. Revisa: docker compose logs app"; exit 1
