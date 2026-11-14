#!/bin/sh
set -eu
umask 077
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$project_dir"
backup_dir="$project_dir/backups"
mkdir -p "$backup_dir"
exec 9> "$backup_dir/.backup.lock"
flock -n 9 || { printf '%s\n' 'Outro backup já está em andamento.' >&2; exit 1; }
# Keep enough room for the dump without taking storage away from PostgreSQL.
available_kb=$(df -Pk "$backup_dir" | awk 'NR==2 {print $4}')
required_kb=2097152
largest_kb=$(find "$backup_dir" -maxdepth 1 -type f -name '*.dump' -printf '%s\n' | sort -nr | head -n 1)
if [ -n "$largest_kb" ]; then
  estimated_kb=$((largest_kb / 1024 * 2 + 524288))
  if [ "$estimated_kb" -gt "$required_kb" ]; then required_kb=$estimated_kb; fi
fi
if [ "$available_kb" -lt "$required_kb" ]; then
  printf 'Backup não iniciado: espaço livre insuficiente (%s KiB; mínimo %s KiB).\n' "$available_kb" "$required_kb" >&2
  exit 1
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/alvorada-$stamp.dump"
test ! -e "$backup_file" && test ! -e "$backup_file.partial"
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    rm -f -- "$backup_file.partial"
    printf '%s\n' 'Backup falhou; as cópias completas anteriores foram preservadas.' >&2
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker compose --env-file .env.hostinger -f compose.hostinger.yaml exec -T db \
  pg_dump -U alvorada_cinzenta -d alvorada_cinzenta -Fc > "$backup_file.partial"
docker compose --env-file .env.hostinger -f compose.hostinger.yaml exec -T db \
  pg_restore --file=/dev/null < "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
python3 "$project_dir/deploy/hostinger/backup-retention.py" --apply
printf 'Backup concluido: %s\n' "$backup_file"
