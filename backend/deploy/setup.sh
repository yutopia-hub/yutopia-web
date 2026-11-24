#!/usr/bin/env bash
# Oracle Cloud Ubuntu 22.04/24.04 서버 최초 1회 설정.
#   사용: bash setup.sh yutopia-api.duckdns.org
# 하는 일: Java 21 · MySQL · Caddy 설치, 방화벽(80/443) 개방, DB 생성, 환경변수 파일 생성
set -euo pipefail

DOMAIN="${1:?도메인을 인자로 주세요. 예) bash setup.sh yutopia-api.duckdns.org}"
APP_DIR=/opt/yutopia
ENV_FILE=/etc/yutopia/yutopia.env
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"   # backend/

echo "==> 패키지 설치"
sudo apt-get update -y
sudo apt-get install -y openjdk-21-jdk-headless mysql-server git curl \
  debian-keyring debian-archive-keyring apt-transport-https gpg iptables-persistent

if ! command -v caddy >/dev/null; then
  echo "==> Caddy 설치"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y caddy
fi

echo "==> 서버 방화벽(iptables) 80/443 열기 (Oracle Ubuntu 이미지는 기본 차단)"
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
done
sudo netfilter-persistent save

echo "==> 서비스 계정/디렉터리"
id yutopia >/dev/null 2>&1 || sudo useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin yutopia
sudo mkdir -p "$APP_DIR" /etc/yutopia
sudo chown yutopia:yutopia "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "==> DB 계정·환경변수 파일 생성"
  DB_PASS="$(openssl rand -hex 16)"
  TOKEN_SECRET="$(openssl rand -hex 32)"
  sudo systemctl enable --now mysql
  # 스키마 생성 (⚠ 기존 yutopia DB 를 삭제 후 재생성 — 최초 설정에서만 실행됨)
  sudo mysql --default-character-set=utf8mb4 < "$REPO_DIR/src/main/resources/db/schema.sql"
  sudo mysql --default-character-set=utf8mb4 yutopia < "$REPO_DIR/src/main/resources/db/seed.sql"
  sudo mysql -e "CREATE USER IF NOT EXISTS 'yutopia'@'localhost' IDENTIFIED BY '${DB_PASS}'; \
                 GRANT SELECT,INSERT,UPDATE,DELETE ON yutopia.* TO 'yutopia'@'localhost'; FLUSH PRIVILEGES;"
  sudo tee "$ENV_FILE" >/dev/null <<EOF
YUTOPIA_DB_URL=jdbc:mysql://localhost:3306/yutopia?serverTimezone=Asia/Seoul&characterEncoding=UTF-8
YUTOPIA_DB_USERNAME=yutopia
YUTOPIA_DB_PASSWORD=${DB_PASS}
YUTOPIA_TOKEN_SECRET=${TOKEN_SECRET}
YUTOPIA_EXPOSE_RESET_TOKEN=false
YUTOPIA_CORS_ORIGINS=https://yutopia-web.vercel.app,http://localhost:5173
PORT=8080
EOF
  sudo chmod 600 "$ENV_FILE"
else
  echo "==> $ENV_FILE 이미 있음 — DB/환경변수 설정은 건너뜀"
fi

echo "==> systemd 서비스 · Caddy 설정"
sudo cp "$REPO_DIR/deploy/yutopia.service" /etc/systemd/system/yutopia.service
sed "s/__DOMAIN__/${DOMAIN}/" "$REPO_DIR/deploy/Caddyfile" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable yutopia
sudo systemctl reload caddy || sudo systemctl restart caddy

echo
echo "설정 완료. 이어서:  bash $REPO_DIR/deploy/deploy.sh"
