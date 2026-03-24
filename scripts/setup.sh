#!/usr/bin/env bash
# ════════════════════════════════════════
# TireWMS — הגדרה ראשונה בטרמוקס
# שימוש (פעם אחת בלבד): bash scripts/setup.sh
# ════════════════════════════════════════

echo "🛞  TireWMS — הגדרה ראשונה"
echo ""

# ── בדוק Python ──
if ! command -v python3 &>/dev/null; then
  echo "📦 מתקין Python..."
  pkg install python -y
else
  echo "✅ Python מותקן"
fi

# ── הגדר Git ──
if ! git config user.email &>/dev/null; then
  git config --global user.email "tire-wms@local"
  git config --global user.name "TireWMS"
  echo "✅ Git הוגדר"
fi

# ── הפוך סקריפטים להרצה ──
chmod +x scripts/start.sh scripts/update.sh scripts/setup.sh
echo "✅ סקריפטים מוכנים להרצה"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ הגדרה הושלמה!"
echo ""
echo "להפעלת השרת:"
echo "  bash scripts/start.sh"
echo ""
echo "לעדכון ידני בלבד:"
echo "  bash scripts/update.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
