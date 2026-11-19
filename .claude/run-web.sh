#!/usr/bin/env bash
# v3 미리보기 화면: 포트 3030, API는 run-api.sh(8030)
set -euo pipefail
export API_INTERNAL_URL="http://127.0.0.1:8030"
cd /c/Workspace/SKN34/wt-v3/frontend
exec pnpm exec next dev --port 3030
