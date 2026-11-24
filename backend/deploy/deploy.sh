#!/usr/bin/env bash
# 빌드 → 배포 → 재시작. 코드를 바꿀 때마다 서버에서 실행한다.
#   사용: (저장소를 pull 한 뒤)  bash backend/deploy/deploy.sh
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR=/opt/yutopia

cd "$BACKEND_DIR"
chmod +x mvnw
echo "==> 빌드 (테스트는 CI 에서 수행하므로 건너뜀)"
./mvnw -B -q -DskipTests package

JAR="$(ls target/yutopia-*.jar | grep -v original | head -1)"
echo "==> 배포: $JAR"
sudo install -o yutopia -g yutopia -m 644 "$JAR" "$APP_DIR/yutopia.jar"
sudo systemctl restart yutopia

echo "==> 기동 대기"
for i in $(seq 1 30); do
  if curl -fs http://localhost:8080/api/areas >/dev/null; then
    echo "OK: 서버가 응답합니다."; exit 0
  fi
  sleep 2
done
echo "서버가 응답하지 않습니다. 로그 확인: sudo journalctl -u yutopia -n 80 --no-pager" >&2
exit 1
