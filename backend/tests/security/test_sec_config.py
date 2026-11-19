"""T16 · T18 설정 지킴: S3 수명 주기 규칙 · Caddy 줄기 · 화면 보안 머리 설정이 빠지지 않았는지 (배포 전 파일 검사)."""

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
TEMPLATE = ROOT / "infra" / "aws" / "staging.yaml"
CADDY = ROOT / "deploy" / "aws" / "Caddyfile"
NEXT_CONFIG = ROOT / "frontend" / "next.config.ts"
PROXY = ROOT / "frontend" / "proxy.ts"


class CfnLoader(yaml.SafeLoader):
    """CloudFormation 짧은 함수(!Ref · !Sub · !GetAtt …)를 {이름: 값}으로 읽는다."""


def _short_function(loader, suffix, node):
    if isinstance(node, yaml.ScalarNode):
        return {suffix: loader.construct_scalar(node)}
    if isinstance(node, yaml.SequenceNode):
        return {suffix: loader.construct_sequence(node)}
    return {suffix: loader.construct_mapping(node)}


CfnLoader.add_multi_constructor("!", _short_function)


def test_deleted_files_do_not_stay_as_old_s3_versions():
    template = yaml.load(TEMPLATE.read_text(encoding="utf-8"), Loader=CfnLoader)  # SafeLoader 바탕
    bucket = template["Resources"]["FileBucket"]["Properties"]
    assert bucket["VersioningConfiguration"]["Status"] == "Enabled"
    assert all(bucket["PublicAccessBlockConfiguration"].values())
    (rule,) = bucket["LifecycleConfiguration"]["Rules"]
    assert rule["Status"] == "Enabled"
    assert rule["NoncurrentVersionExpiration"] == {"NoncurrentDays": 7}  # 처리방침 백업 기간과 같게
    assert rule["ExpiredObjectDeleteMarker"] is True
    assert rule["AbortIncompleteMultipartUpload"]["DaysAfterInitiation"] >= 1
    # 버킷 전체에 걸고, CFN 제약(ExpiredObjectDeleteMarker와 함께 못 쓰는 칸)을 지킨다
    assert not {"Prefix", "TagFilters", "ExpirationInDays", "ExpirationDate"} & set(rule)


def test_caddy_streams_events_without_gzip_and_pins_https():
    text = CADDY.read_text(encoding="utf-8")
    assert "@compress not path /api/stream*" in text and "encode @compress gzip" in text
    assert "\tencode gzip" not in text  # 모든 응답을 압축하던 줄이 돌아오면 실시간이 멈춘다
    assert "flush_interval -1" in text
    assert 'Strict-Transport-Security "max-age=31536000; includeSubDomains"' in text
    assert "-Server" in text


def test_web_config_keeps_dev_streaming_and_hides_the_framework():
    text = NEXT_CONFIG.read_text(encoding="utf-8")
    for line in (
        'distDir: process.env.NEXT_DIST_DIR || ".next"',
        "compress: false",
        "poweredByHeader: false",
        "agentRules: false",
        'source: "/sw.js"',
    ):
        assert line in text


def test_web_proxy_sets_a_strict_policy():
    text = PROXY.read_text(encoding="utf-8")
    for piece in (
        "'nonce-${nonce}' 'strict-dynamic'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        '"x-frame-options": "DENY"',
        '"x-content-type-options": "nosniff"',
        "permissions-policy",
        "strict-transport-security",
    ):
        assert piece in text
    assert "'unsafe-inline'" not in text.split("script-src", 1)[1].split("\n", 1)[0]


def test_web_proxy_passes_only_same_site_paths():
    """로그인 뒤 돌아갈 next용 지금 주소 머리(x-mj-path): 이 사이트 안 경로만 넘기고, 아니면 브라우저 값까지 지운다.
    실제 동작(깊은 주소 · _rsc · '//' · 바깥 주소 · 1,024자)은 b7.md 2장 Node 실험."""
    text = PROXY.read_text(encoding="utf-8")
    session = (ROOT / "frontend" / "lib" / "session.ts").read_text(encoding="utf-8")
    assert 'const PATH_HEADER = "x-mj-path"' in text
    assert "safeNext(request.nextUrl.pathname + request.nextUrl.search)" in text
    assert "forwarded.delete(PATH_HEADER)" in text
    assert 'safeNext((await headers()).get("x-mj-path"))' in session  # 읽는 쪽도 다시 본다
