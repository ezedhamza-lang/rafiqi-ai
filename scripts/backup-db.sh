#!/usr/bin/env bash
# نسخة احتياطية لقاعدة بيانات المنصة (pg_dump) مع الاحتفاظ بآخر 14 نسخة.
# الاستعمال اليدوي:   ./scripts/backup-db.sh
# عبر docker-compose: docker compose exec db pg_dump ... (انظر backup-db service)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/school_platform-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# يعمل داخل الحاوية أو على المضيف مباشرة
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q '^rafiqi-db$'; then
  docker compose exec -T db pg_dump -U school_user school_platform | gzip > "$OUT"
else
  echo "حاوية rafiqi-db غير موجودة — محاولة اتصال مباشر بـ DATABASE_URL"
  pg_dump "${DATABASE_URL:?DATABASE_URL غير معرّف}" | gzip > "$OUT"
fi

echo "✓ النسخة جاهزة: $OUT ($(du -h "$OUT" | cut -f1))"

# حذف النسخ الأقدم من الحد المسموح
ls -1t "$BACKUP_DIR"/school_platform-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
  echo "✗ حُذفت النسخة القديمة: $old"
done