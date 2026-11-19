#!/usr/bin/env bash
# e2e 시험 DB 돌보기 (B8). 접속 값은 리드 도구 .claude/env.sh로 불러오고 화면에 찍지 않아요.
#   snapshot : 시연 DB(mitjip_v3)를 기준 사본(mitjip_v3_e2e_base)으로 한 번 떠 둬요(시험 한 번 돌릴 때 처음 한 번)
#   reset    : 시험 DB(mitjip_v3_e2e)를 기준 사본으로 되돌리고, Redis db 6의 요청 한도 키(rl:*)를 지워요(시험마다)
#   drop-base: 기준 사본을 지워요(시험이 끝난 뒤)
# 공유 시연 DB(mitjip_v3)는 읽기만 해요(pg_dump). docker compose down -v 같은 것은 하지 않아요.
set -euo pipefail
cd "$(dirname "$0")"
. ../../../.claude/env.sh
PG=skn34-final-db-1
RD=skn34-final-redis-1
SRC=mitjip_v3
BASE=mitjip_v3_e2e_base
DB=mitjip_v3_e2e

case "${1:-}" in
  snapshot)
    docker exec "$PG" dropdb -U "$POSTGRES_USER" --if-exists --force "$BASE"
    docker exec "$PG" createdb -U "$POSTGRES_USER" "$BASE"
    docker exec "$PG" sh -c "pg_dump -U \"\$POSTGRES_USER\" $SRC | psql -q -U \"\$POSTGRES_USER\" $BASE" >/dev/null
    ;;
  reset)
    # 기준 사본에서 바로 복사해요(템플릿 복사). API는 pool_pre_ping으로 다시 이어 붙어요
    docker exec "$PG" dropdb -U "$POSTGRES_USER" --if-exists --force "$DB"
    docker exec "$PG" createdb -U "$POSTGRES_USER" -T "$BASE" "$DB"
    # 가입 · 로그인 · 손님 계산 · 리뷰 같은 요청 한도는 시험을 되풀이하면 차요. B8 Redis db 6의 한도 키만 지워요
    docker exec "$RD" sh -c "redis-cli -n 6 --scan --pattern 'rl:*' | xargs -r redis-cli -n 6 DEL" >/dev/null
    ;;
  drop-base)
    docker exec "$PG" dropdb -U "$POSTGRES_USER" --if-exists --force "$BASE"
    ;;
  *)
    echo "사용: bash e2e/tools/db.sh snapshot|reset|drop-base" >&2
    exit 2
    ;;
esac
