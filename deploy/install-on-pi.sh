#!/usr/bin/env bash
# ラズパイに EXHILARATION を入れて自動起動させるスクリプト。
#
#   git clone https://github.com/masashi-bayman/exhilaration-game.git ~/exhilaration-game
#   cd ~/exhilaration-game
#   bash deploy/install-on-pi.sh
#
# 既定では Python の簡易サーバを systemd で常駐させます（ポート 8080）。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="$(id -un)"
PORT="${PORT:-8080}"

echo "==> インストール元 : $REPO_DIR"
echo "==> 実行ユーザ     : $USER_NAME"
echo "==> ポート         : $PORT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 が見つかりません。sudo apt install -y python3 を先に実行してください。" >&2
  exit 1
fi

UNIT=/etc/systemd/system/exhilaration.service
echo "==> systemd ユニットを作成: $UNIT"
sudo tee "$UNIT" >/dev/null <<UNITEOF
[Unit]
Description=EXHILARATION (皿割りブレイカー) static server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${REPO_DIR}
ExecStart=/usr/bin/python3 ${REPO_DIR}/deploy/serve.py ${PORT}
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNITEOF

sudo systemctl daemon-reload
sudo systemctl enable --now exhilaration
sleep 1
sudo systemctl --no-pager --lines=5 status exhilaration || true

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "==> 完了。同じ Wi-Fi のスマホ・PC から遊べます:"
echo "      http://${IP:-<ラズパイのIP>}:${PORT}/"
echo
echo "    停止 : sudo systemctl stop exhilaration"
echo "    更新 : cd ${REPO_DIR} && git pull && sudo systemctl restart exhilaration"
