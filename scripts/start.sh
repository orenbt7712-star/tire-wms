#!/usr/bin/env bash
# ════════════════════════════════════════
# TireWMS — הפעל שרת + עדכון אוטומטי
# שימוש: bash scripts/start.sh
# ════════════════════════════════════════

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

PORT=${1:-8080}

echo "🛞  TireWMS מתחיל..."
echo ""

# ── עדכון ראשוני ──
echo "🔄 בודק עדכונים מ-GitHub..."
if git pull origin main -q 2>/dev/null; then
  echo "✅ מעודכן לגרסה האחרונה"
else
  echo "⚠️  לא הצלחתי לעדכן (אין אינטרנט?)"
fi
echo ""

# ── מצא IP מקומי ──
LOCAL_IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(ip -4 addr 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
fi
[ -z "$LOCAL_IP" ] && LOCAL_IP="IP-של-הטלפון"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 שרת פועל: http://localhost:$PORT"
echo "📱 לעובדים:  http://$LOCAL_IP:$PORT"
echo "🔄 בדיקת עדכון: כל 5 דקות"
echo "🛑 לעצירה: Ctrl+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── לולאת עדכון רקע ──
_auto_update() {
  while true; do
    sleep 300
    BEFORE=$(git -C "$DIR" rev-parse HEAD 2>/dev/null)
    git -C "$DIR" pull origin main -q 2>/dev/null
    AFTER=$(git -C "$DIR" rev-parse HEAD 2>/dev/null)
    if [ "$BEFORE" != "$AFTER" ]; then
      echo "$(date '+%H:%M') ✅ גרסה חדשה ירדה — עובדים יתעדכנו בטעינה הבאה"
    fi
  done
}
_auto_update &
UPDATE_PID=$!

# ── נקה עם Ctrl+C ──
_cleanup() {
  kill $UPDATE_PID 2>/dev/null
  echo ""
  echo "👋 שרת נסגר"
  exit 0
}
trap _cleanup INT TERM

# ── הפעל שרת HTTP ──
python3 -m http.server "$PORT" --bind 0.0.0.0
_cleanup
