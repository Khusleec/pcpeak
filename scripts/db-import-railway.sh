#!/usr/bin/env bash
# Railway MySQL руу dump оруулах. Жишээ:
#   export RAILWAY_DATABASE_URL='mysql://root:PASS@host:PORT/railway'
#   ./scripts/db-import-railway.sh local-mysql-dump.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="${1:?Usage: $0 <dump.sql>}"
SQL_PATH="$SQL_FILE"
[[ "$SQL_FILE" = /* ]] || SQL_PATH="$ROOT/$SQL_FILE"
[[ -f "$SQL_PATH" ]] || { echo "Файл олдсонгүй: $SQL_PATH"; exit 1; }

URL="${RAILWAY_DATABASE_URL:?Set RAILWAY_DATABASE_URL=mysql://user:pass@host:port/db}"
# mysql://user:password@host:port/database  — password-д @ байвал URL encode хэрэгтэй
if [[ "$URL" != mysql://* ]]; then echo "RAILWAY_DATABASE_URL mysql://-ээр эхлэнэ"; exit 1; fi
REST="${URL#mysql://}"
CREDS="${REST%%@*}"
HOSTPORTDB="${REST#*@}"
USER="${CREDS%%:*}"
PASS="${CREDS#*:}"
HOST="${HOSTPORTDB%%:*}"
PORTDB="${HOSTPORTDB#*:}"
PORT="${PORTDB%%/*}"
DB="${PORTDB#*/}"
DB="${DB%/}"

echo "Import -> $HOST:$PORT / $DB"
export MYSQL_PWD="$PASS"
mysql --protocol=TCP -h "$HOST" -P "$PORT" -u "$USER" "$DB" < "$SQL_PATH"
unset MYSQL_PWD
echo "Import дууссан."
