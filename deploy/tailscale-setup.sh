#!/usr/bin/env bash
# ============================================================
#  EXHILARATION を Tailscale の HTTPS URL で公開する
#
#    bash deploy/tailscale-setup.sh              # tailnet 内に公開（推奨）
#    bash deploy/tailscale-setup.sh --funnel     # インターネットにも公開
#    bash deploy/tailscale-setup.sh --off        # 公開をやめる
#    PORT=9000 bash deploy/tailscale-setup.sh    # ポート指定
#
#  HTTPS になるので、Android の PWA インストールとオフライン再生が
#  フルで効くようになります。
#
#  事前に管理画面で 1 回だけ設定が必要:
#    https://login.tailscale.com/admin/dns
#      → MagicDNS を有効化
#      → HTTPS Certificates を Enable
# ============================================================
set -euo pipefail

PORT="${PORT:-8080}"
MODE="serve"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for arg in "$@"; do
  case "$arg" in
    --funnel) MODE="funnel" ;;
    --off)    MODE="off" ;;
    --help|-h) sed -n '2,17p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "不明なオプション: $arg" >&2; exit 1 ;;
  esac
done

if ! command -v tailscale >/dev/null 2>&1; then
  cat >&2 <<'MSG'
tailscale が見つかりません。先に入れてください:

  curl -fsSL https://tailscale.com/install.sh | sh
  sudo tailscale up

MSG
  exit 1
fi

# --- 公開をやめる ---
if [ "$MODE" = "off" ]; then
  echo "==> 公開を解除します"
  sudo tailscale funnel --https=443 off 2>/dev/null || true
  sudo tailscale serve --https=443 off 2>/dev/null || true
  sudo tailscale serve reset 2>/dev/null || true
  echo "==> 解除しました（ゲームのサーバ自体は動いたままです）"
  echo "    完全に止める: sudo systemctl stop exhilaration"
  exit 0
fi

# --- ローカルでゲームが配信されているか ---
if ! curl -fsS "http://localhost:${PORT}/" -o /dev/null 2>/dev/null; then
  echo "==> localhost:${PORT} が応答しないので、サービスを確認します"
  if systemctl list-unit-files 2>/dev/null | grep -q '^exhilaration.service'; then
    sudo systemctl start exhilaration || true
  else
    echo "    exhilaration サービスが未登録です。先にこちらを実行してください:"
    echo "      PORT=${PORT} bash ${REPO_DIR}/deploy/install-on-pi.sh"
    exit 1
  fi
  sleep 2
  if ! curl -fsS "http://localhost:${PORT}/" -o /dev/null 2>/dev/null; then
    echo "    まだ応答しません。ログを確認してください:" >&2
    echo "      sudo journalctl -u exhilaration -n 30 --no-pager" >&2
    exit 1
  fi
fi
echo "==> localhost:${PORT} で配信中であることを確認しました"

# --- Tailscale に前面を任せる ---
echo "==> tailscale ${MODE} を設定します（HTTPS 443 → localhost:${PORT}）"
if ! sudo tailscale "${MODE}" --bg --https=443 "http://localhost:${PORT}" 2>/dev/null; then
  # 古い Tailscale はこちらの書き方
  echo "    新しい書き方が通らなかったので、旧構文で再試行します"
  sudo tailscale "${MODE}" https / "http://localhost:${PORT}"
fi

# --- URL を出す ---
HOSTNAME_TS=""
if command -v python3 >/dev/null 2>&1; then
  HOSTNAME_TS="$(tailscale status --json 2>/dev/null \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null || true)"
fi

echo
echo "==================================================="
if [ -n "$HOSTNAME_TS" ]; then
  echo "  遊べる URL:  https://${HOSTNAME_TS}/"
else
  echo "  遊べる URL は次のコマンドで確認できます:"
  echo "    tailscale serve status"
fi
echo "==================================================="
echo
if [ "$MODE" = "serve" ]; then
  echo "  ※ tailnet 内限定です。スマホ側にも Tailscale アプリを入れて"
  echo "     同じアカウントでログインしてください。"
  echo "  ※ 誰にでも見せたい場合は --funnel を付けて実行してください"
  echo "     （管理画面で Funnel の許可が必要です）。"
else
  echo "  ※ インターネットに公開されています。URL を知っていれば誰でも遊べます。"
fi
echo
echo "  状態確認 : tailscale ${MODE} status"
echo "  解除     : bash ${REPO_DIR}/deploy/tailscale-setup.sh --off"
echo
echo "  HTTPS になったので、スマホでこの URL を開けば"
echo "  Android は「アプリをインストール」、iPhone は「ホーム画面に追加」で"
echo "  オフラインでも遊べるアプリになります。"
