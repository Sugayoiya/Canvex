#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Canvex — NPM (Nginx Proxy Manager) 自动初始化脚本
# docker compose up -d 后运行一次即可
# 用法: bash scripts/init-npm.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

# ── 自动加载 .env ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "找不到 $ENV_FILE，请先 cp .env.example .env 并填写配置"
  exit 1
fi

set -a
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" || "$line" != *=* ]] && continue
  eval "export $line" 2>/dev/null || true
done < "$ENV_FILE"
set +a

# ── 从 .env 读取配置 ──
NPM_ADMIN_PORT="${NPM_ADMIN_PORT:-81}"
HTTP_PORT="${HTTP_PORT:-80}"
NPM_EMAIL="${NPM_EMAIL:-admin@canvex.studio}"
NPM_PASSWORD="${NPM_PASSWORD:-Admin123!}"

BASE="http://localhost:${NPM_ADMIN_PORT}/api"

if [ "$HTTP_PORT" = "80" ]; then
  HOST_URL="http://localhost"
else
  HOST_URL="http://localhost:${HTTP_PORT}"
fi

MAX_RETRIES=30
RETRY_INTERVAL=2

# ── 颜色 ──
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[…]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo "─────────────────────────────────────"
echo " Canvex — NPM 初始化"
echo " 配置文件: $ENV_FILE"
echo " NPM 管理端口: $NPM_ADMIN_PORT"
echo " HTTP 端口: $HTTP_PORT"
echo "─────────────────────────────────────"

# ── 1. 等待 NPM 就绪 ──
warn "等待 NPM 启动..."
for i in $(seq 1 $MAX_RETRIES); do
  STATUS=$(curl -s "$BASE/" 2>/dev/null || echo "")
  if echo "$STATUS" | grep -q '"status":"OK"'; then
    info "NPM 已就绪"
    break
  fi
  [ "$i" -eq "$MAX_RETRIES" ] && fail "NPM 未能在 $((MAX_RETRIES * RETRY_INTERVAL))s 内启动"
  sleep $RETRY_INTERVAL
done

# ── 2. 检查是否需要初始化 ──
SETUP=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('setup',True))" 2>/dev/null || echo "True")

if [ "$SETUP" = "False" ]; then
  warn "NPM 未初始化，使用默认凭据创建管理员..."
  INIT_TOKEN=$(curl -s -X POST "$BASE/tokens" \
    -H 'Content-Type: application/json' \
    -d '{"identity":"admin@example.com","secret":"changeme"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

  if [ -z "$INIT_TOKEN" ]; then
    fail "无法使用默认凭据登录，请手动访问 http://localhost:${NPM_ADMIN_PORT} 完成初始化后重新运行此脚本"
  fi

  curl -s -X PUT "$BASE/users/1" \
    -H "Authorization: Bearer $INIT_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"Admin\",\"nickname\":\"Admin\",\"email\":\"$NPM_EMAIL\"}" > /dev/null

  curl -s -X PUT "$BASE/users/1/auth" \
    -H "Authorization: Bearer $INIT_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"type\":\"password\",\"current\":\"changeme\",\"secret\":\"$NPM_PASSWORD\"}" > /dev/null

  info "管理员凭据已更新为 $NPM_EMAIL"
fi

# ── 3. 登录获取 Token ──
warn "登录 NPM..."
TOKEN=$(curl -s -X POST "$BASE/tokens" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$NPM_EMAIL\",\"secret\":\"$NPM_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

[ -z "$TOKEN" ] && fail "登录失败，请检查 .env 中的 NPM_EMAIL / NPM_PASSWORD"
info "登录成功"

# ── 4. 设置默认页面为 404 ──
curl -s -X PUT "$BASE/settings/default-site" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"value":"404"}' > /dev/null
info "默认页面已设置为 404"

# ── 5. 检查是否已有代理规则 ──
EXISTING=$(curl -s "$BASE/nginx/proxy-hosts" \
  -H "Authorization: Bearer $TOKEN")

COUNT=$(echo "$EXISTING" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$COUNT" -gt "0" ]; then
  info "已存在 $COUNT 条代理规则，跳过创建（如需重建请先在管理面板删除旧规则）"
else
  # ── 6. 创建代理规则 ──
  warn "创建代理规则..."
  curl -s -X POST "$BASE/nginx/proxy-hosts" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{
      "domain_names": ["localhost", "127.0.0.1"],
      "forward_scheme": "http",
      "forward_host": "web",
      "forward_port": 3000,
      "allow_websocket_upgrade": true,
      "block_exploits": false,
      "caching_enabled": false,
      "access_list_id": 0,
      "meta": {"letsencrypt_agree": false, "dns_challenge": false},
      "advanced_config": "",
      "locations": [
        {
          "path": "/api",
          "forward_scheme": "http",
          "forward_host": "api",
          "forward_port": 8000,
          "advanced_config": ""
        }
      ]
    }' > /dev/null
  info "代理规则已创建: localhost → web:3000, /api → api:8000"
fi

echo ""
info "NPM 初始化完成！"
echo "  前端:     $HOST_URL"
echo "  API:      $HOST_URL/api/v1/..."
echo "  管理面板: http://localhost:${NPM_ADMIN_PORT}"
echo "  账号:     $NPM_EMAIL"
