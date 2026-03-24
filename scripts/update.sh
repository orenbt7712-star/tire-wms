#!/usr/bin/env bash
# ════════════════════════════════════════
# TireWMS — עדכון ידני מהיר
# שימוש: bash scripts/update.sh
# ════════════════════════════════════════

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

echo "🔄 מעדכן TireWMS..."

BEFORE=$(git rev-parse HEAD 2>/dev/null)
git pull origin main
AFTER=$(git rev-parse HEAD 2>/dev/null)

echo ""
if [ "$BEFORE" = "$AFTER" ]; then
  echo "✅ כבר בגרסה העדכנית ביותר"
else
  echo "✅ עודכן! עובדים יקבלו את הגרסה החדשה בטעינה הבאה"
fi
