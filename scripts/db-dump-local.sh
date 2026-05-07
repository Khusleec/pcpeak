#!/usr/bin/env bash
# Локал docker-compose MySQL -> dump.sql (репо root-оос ажиллуулна)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="${1:-local-mysql-dump.sql}"
echo "Dump -> $OUT"
docker compose exec -T mysql bash -lc \
  'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces 2>/dev/null' \
  > "$OUT"
echo "OK ($(wc -c < "$OUT") bytes)"
