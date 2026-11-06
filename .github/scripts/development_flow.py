"""PR 승격 경로와 검증된 main 배포 커밋을 확인한다."""

import json
import os
from pathlib import Path
import re
import subprocess
import sys

REPOSITORY = "SKNETWORKS-FAMILY-AICAMP/SKN34-FINAL-1TEAM"


def check_pr(event):
    pr = event["pull_request"]
    if pr["base"]["ref"] == "main":
        head = pr["head"]
        if head["ref"] != "dev" or (head.get("repo") or {}).get("full_name") != REPOSITORY:
            raise ValueError("기능 PR은 dev로, main 승격 PR은 공식 저장소 dev에서 올려 주세요.")


def gh_api(arguments):
    return json.loads(subprocess.check_output(["gh", "api", *arguments], text=True))


def deploy_source(env, api=gh_api):
    event = env["GITHUB_EVENT_NAME"]
    if (env["GITHUB_REPOSITORY"] != REPOSITORY or env["GITHUB_REF"] != "refs/heads/main"
            or event not in ("push", "workflow_dispatch")):
        raise ValueError("공식 main에서만 배포할 수 있습니다.")
    sha = env["GITHUB_SHA"]
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("배포 커밋 형식이 잘못됐습니다.")
    if env.get("ROLLBACK", "false") == "true":
        if event != "workflow_dispatch":
            raise ValueError("복구는 수동 실행에서만 요청할 수 있습니다.")
        return sha, True  # main의 복구 스크립트로 이전 이미지를 복원한다.
    latest = api([f"repos/{REPOSITORY}/git/ref/heads/main"])["object"]["sha"]
    if not re.fullmatch(r"[0-9a-f]{40}", latest):
        raise ValueError("main 커밋 형식이 잘못됐습니다.")
    if event == "workflow_dispatch":
        sha = latest
        runs = api(["--method", "GET", f"repos/{REPOSITORY}/actions/workflows/ci.yml/runs",
                    "-f", "branch=main", "-f", f"head_sha={sha}", "-f", "status=success",
                    "-f", "per_page=100"])["workflow_runs"]
        if not any(r["event"] in ("push", "workflow_dispatch") and r["head_branch"] == "main"
                   and r["head_sha"] == sha and r["conclusion"] == "success" for r in runs):
            raise ValueError("최신 main 커밋의 CI 성공 기록이 없습니다.")
    return sha, sha == latest


if __name__ == "__main__":
    if sys.argv[1:] == ["pr"]:
        if os.environ.get("GITHUB_EVENT_NAME") == "pull_request":
            check_pr(json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8")))
    elif sys.argv[1:] == ["deploy"]:
        sha, deploy = deploy_source(os.environ)
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"sha={sha}\ndeploy={str(deploy).lower()}\n")
        print("main 배포 커밋 확인 완료" if deploy else "더 최신 main 커밋이 있어 배포를 건너뜁니다.")
    else:
        raise SystemExit("사용법: development_flow.py pr|deploy")
