"""배포 없이 PR 경로·커밋 선택·실패 시 차단을 검증한다."""

from pathlib import Path
import sys
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from development_flow import REPOSITORY, check_pr, deploy_source

SHA = "a" * 40
NEW = "b" * 40


class FlowTests(unittest.TestCase):
    def env(self, **changes):
        return {"GITHUB_REPOSITORY": REPOSITORY, "GITHUB_REF": "refs/heads/main",
                "GITHUB_EVENT_NAME": "push", "GITHUB_SHA": SHA, **changes}

    def pr(self, base, head, repo):
        return {"pull_request": {"base": {"ref": base}, "head": {"ref": head, "repo": repo}}}

    def test_feature_to_dev(self):
        check_pr(self.pr("dev", "feat-test", {"full_name": "person/fork"}))

    def test_official_dev_to_main(self):
        check_pr(self.pr("main", "dev", {"full_name": REPOSITORY}))

    def test_main_rejects_feature_fork_and_deleted_repo(self):
        for head, repo in [("feat-test", {"full_name": REPOSITORY}),
                           ("dev", {"full_name": "person/fork"}), ("dev", None)]:
            with self.subTest(head=head, repo=repo), self.assertRaises(ValueError):
                check_pr(self.pr("main", head, repo))

    def test_main_push_selects_exact_commit(self):
        api = Mock(return_value={"object": {"sha": SHA}})
        self.assertEqual(deploy_source(self.env(), api), (SHA, True))
        api.assert_called_once()

    def test_stale_push_skips(self):
        self.assertEqual(deploy_source(self.env(), Mock(return_value={"object": {"sha": NEW}})),
                         (SHA, False))

    def test_denied_events_refs_forks_and_invalid_sha(self):
        for change in [{"GITHUB_EVENT_NAME": "pull_request"}, {"GITHUB_EVENT_NAME": "workflow_run"},
                       {"GITHUB_REF": "refs/heads/dev"}, {"GITHUB_REF": "refs/tags/v1"},
                       {"GITHUB_REPOSITORY": "person/fork"}, {"GITHUB_SHA": "bad"}]:
            api = Mock()
            with self.subTest(change=change), self.assertRaises(ValueError):
                deploy_source(self.env(**change), api)
            api.assert_not_called()

    def test_manual_uses_latest_main_after_successful_ci(self):
        for event in ("push", "workflow_dispatch"):
            run = {"event": event, "head_branch": "main", "head_sha": NEW, "conclusion": "success"}
            api = Mock(side_effect=[{"object": {"sha": NEW}}, {"workflow_runs": [run]}])
            self.assertEqual(deploy_source(self.env(GITHUB_EVENT_NAME="workflow_dispatch"), api),
                             (NEW, True))

    def test_manual_rejects_missing_failed_wrong_sha_or_pr_ci(self):
        valid = {"event": "push", "head_branch": "main", "head_sha": SHA, "conclusion": "success"}
        candidates = [[], [{**valid, "conclusion": "failure"}], [{**valid, "head_sha": NEW}],
                      [{**valid, "event": "pull_request"}], [{**valid, "head_branch": "dev"}]]
        for runs in candidates:
            api = Mock(side_effect=[{"object": {"sha": SHA}}, {"workflow_runs": runs}])
            with self.subTest(runs=runs), self.assertRaises(ValueError):
                deploy_source(self.env(GITHUB_EVENT_NAME="workflow_dispatch"), api)

    def test_rollback_is_manual_and_does_not_need_current_ci(self):
        api = Mock()
        self.assertEqual(deploy_source(self.env(GITHUB_EVENT_NAME="workflow_dispatch", ROLLBACK="true"), api),
                         (SHA, True))
        api.assert_not_called()
        with self.assertRaises(ValueError):
            deploy_source(self.env(ROLLBACK="true"), api)

    def test_api_failure_and_invalid_remote_sha_do_not_deploy(self):
        with self.assertRaises(OSError):
            deploy_source(self.env(), Mock(side_effect=OSError("offline")))
        with self.assertRaises(ValueError):
            deploy_source(self.env(), Mock(return_value={"object": {"sha": "bad"}}))
