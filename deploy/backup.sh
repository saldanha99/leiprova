#!/bin/sh
set -eu
umask 077

backup_dir="/opt/leiprova/backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

backup_file="$backup_dir/leiprova-$timestamp.dump"
partial_file="$backup_file.part"
trap '[ ! -f "$partial_file" ] || rm -f "$partial_file"' 0 1 2 15

cd /opt/leiprova
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$partial_file"
docker compose exec -T db pg_restore --list < "$partial_file" >/dev/null
mv "$partial_file" "$backup_file"
find "$backup_dir" -type f -name 'leiprova-*.dump' -mtime +14 -delete
