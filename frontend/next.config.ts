import type { NextConfig } from "next";

// 브라우저는 항상 같은 주소의 /api/* 로 부른다.
// 개발 중에는 Next가 api 컨테이너로 넘기고, 운영에서는 Caddy가 먼저 받아 넘긴다.
const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  // v3: 같은 폴더에서 여러 역할이 dev · build를 따로 돌릴 수 있게 출력 폴더를 바꿀 수 있어요(기본 .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // v3: 개발 서버의 /api 다시 쓰기가 gzip으로 SSE를 막아서 압축을 꺼요(dev-02 실험). 운영 압축은 Caddy가 맡아요
  compress: false,
  // Next가 /api로 넘기는 요청 본문은 기본 10MB까지만 옮긴다. 도면은 20MB까지 받으므로 넉넉히 늘린다.
  // (운영에서 /api를 앞단 프록시가 바로 API로 보내면 이 값과 상관없다.)
  experimental: { proxyClientMaxBodySize: "25mb" },
  // 보안: 응답에 'X-Powered-By: Next.js'를 붙이지 않아요(쓰는 틀을 덜 드러내요). 화면 보안 머리는 proxy.ts
  poweredByHeader: false,
  // next dev가 AI 도구를 알아보고 frontend/AGENTS.md(지시문)를 만들거나 고치지 않게 꺼요(plan-build 7장)
  agentRules: false,
  async headers() {
    return [
      {
        // 서비스 워커(B4 sw.js)는 늘 새로 받고, 자기 안에서도 같은 주소 스크립트만 써요(Next PWA 안내)
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
