#!/bin/sh
set -eu
umask 077
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$project_dir"
backup_dir="$project_dir/backups"
mkdir -p "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/alvorada-$stamp.dump"
# A failed dump retains .partial and is never treated as a usable backup.
docker compose --env-file .env.hostinger -f compose.hostinger.yaml exec -T db \
  pg_dump -U alvorada_cinzenta -d alvorada_cinzenta -Fc > "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
find "$backup_dir" -maxdepth 1 -type f -name 'alvorada-????????T??????Z.dump' -mtime +13 -delete
printf 'Backup concluido: %s\n' "$backup_file"
