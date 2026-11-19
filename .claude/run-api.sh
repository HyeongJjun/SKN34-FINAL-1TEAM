#!/usr/bin/env bash
# v3 미리보기 API: DB mitjip_v3 · Redis db 7 · 포트 8030 (화면은 run-web.sh, 3030)
set -euo pipefail
. "$(dirname "$0")/env.sh"
export APP_ENV=local DEMO_AUTO=false JEV_ENABLED=false
export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER:-mitjip}:${POSTGRES_PASSWORD}@127.0.0.1:${DB_HOST_PORT:-5433}/mitjip_v3"
export REDIS_URL="redis://127.0.0.1:${REDIS_HOST_PORT:-6379}/7"
export ALLOWED_ORIGINS="http://localhost:3030,http://127.0.0.1:3030,http://vendor.localhost:3030,http://admin.localhost:3030,http://localhost:3102,http://vendor.localhost:3102,http://localhost:3103,http://vendor.localhost:3103,http://admin.localhost:3103,http://localhost:3104,http://localhost:3105,http://localhost:3106,http://vendor.localhost:3106,http://localhost:3108,http://vendor.localhost:3108,http://admin.localhost:3108,http://localhost:3109"
export FILES_DIR="C:/Workspace/SKN34/.v3-files"
cd /c/Workspace/SKN34/wt-v3/backend
uv run alembic upgrade head
exec uv run uvicorn app.main:app --host 127.0.0.1 --port 8030 --reload
