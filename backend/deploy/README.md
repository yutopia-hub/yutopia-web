# 🚀 Oracle Cloud 배포 가이드

```
브라우저(Vercel, HTTPS) ──▶ yutopia-api.duckdns.org ──▶ Caddy(443, 자동 HTTPS) ──▶ Spring Boot(8080) ──▶ MySQL(3306, 로컬 전용)
```

## 1. 서버 만들기 (Oracle Cloud 콘솔)

| 항목 | 값 |
| --- | --- |
| Image | Ubuntu 22.04 또는 24.04 |
| Shape | `VM.Standard.A1.Flex` 2 OCPU / 12GB (Always Free). 용량 부족이면 `VM.Standard.E2.1.Micro` + 스왑 |
| SSH key | 키 쌍 생성 후 개인키(`.key`) 다운로드 |

**VCN Security List → Ingress Rules**: `80`, `443` (TCP, Source `0.0.0.0/0`) 추가. `3306`, `8080`은 열지 않아요.

## 2. DuckDNS

`yutopia-api` 서브도메인의 IP를 서버 공인 IP로 설정해요(`update ip`).

## 3. 서버 접속 후 최초 설정

```bash
ssh -i 키파일.key ubuntu@서버공인IP

git clone https://github.com/yutopia-hub/yutopia-web.git
cd yutopia-web/backend
bash deploy/setup.sh yutopia-api.duckdns.org
bash deploy/deploy.sh
```

- `setup.sh`: Java 21, MySQL, Caddy 설치 → 방화벽 80/443 개방 → DB·계정·샘플 데이터 → 환경변수(`/etc/yutopia/yutopia.env`, 비밀번호와 토큰 키는 랜덤 생성) → systemd/Caddy 등록
- `deploy.sh`: 빌드 → `/opt/yutopia/yutopia.jar` 교체 → 재시작 → 응답 확인
- 레포가 private이면 `git clone` 때 GitHub 개인 액세스 토큰이 필요해요.

## 4. 확인

```bash
curl https://yutopia-api.duckdns.org/api/areas
# → [{"code":"1","name":"서울특별시"}, ...]
```

## 5. 프론트 연결

Vercel → Settings → Environment Variables에 `VITE_API_BASE_URL=https://yutopia-api.duckdns.org`(Config, Production)를 추가하고 **Redeploy**해요.

## 코드를 고친 뒤 재배포

```bash
cd ~/yutopia-web && git pull && bash backend/deploy/deploy.sh
```

## 운영 명령

```bash
sudo systemctl status yutopia                 # 상태
sudo journalctl -u yutopia -f                 # 실시간 로그
sudo journalctl -u yutopia -n 80 --no-pager   # 최근 로그
sudo systemctl restart yutopia                # 재시작
sudo nano /etc/yutopia/yutopia.env && sudo systemctl restart yutopia   # 환경변수 수정
```

## 주의

- `schema.sql`은 `yutopia` DB를 지우고 다시 만들어요. `setup.sh`는 환경변수 파일이 없을 때(최초)만 이 작업을 해요. 이후에는 스키마를 실행하지 마세요. 데이터가 사라져요.
- 서버를 한 대로 쓰므로, 비밀번호 재설정 토큰은 재시작하면 사라져요.
- `YUTOPIA_EXPOSE_RESET_TOKEN=false`라서 재설정 토큰이 응답으로 나가지 않아요. 메일 발송이 없어서 운영 환경에서 비밀번호 찾기는 사실상 동작하지 않아요. 필요하면 메일 발송을 추가해야 해요.
- Oracle 유휴 인스턴스는 회수될 수 있어요. 가끔 접속하거나 모니터링해 주세요.
- DuckDNS 도메인은 서버 IP가 바뀌면 다시 갱신해야 해요(예약 공인 IP 사용을 권장해요).
