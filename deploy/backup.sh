#!/usr/bin/env bash
# Respaldo diario de la base de datos y las fotos. Uso: ./backup.sh [carpeta-destino]
# Programarlo con cron:  17 3 * * *  cd /ruta/a/deploy && ./backup.sh /ruta/respaldos
set -euo pipefail
cd "$(dirname "$0")"
DEST="${1:-./backups}"
mkdir -p "$DEST"
# La copia se hace dentro del contenedor (VACUUM INTO es consistente aunque la tienda esté en uso) y se trae al servidor.
docker compose exec -T app node --disable-warning=ExperimentalWarning src/backup.js /data/backups >/dev/null
LATEST=$(docker compose exec -T app sh -c 'ls -1 /data/backups | sort | tail -1' | tr -d '\r')
docker compose cp "app:/data/backups/$LATEST" "$DEST/$LATEST"
echo "Respaldo guardado en $DEST/$LATEST"
