// 믿집 서비스 워커(dev-01 · B4). 오프라인 안내 한 장만 받아 두고, 화면 · API · 글꼴 · 사진은 받아 두지 않아요(늘 네트워크).
// - 설치: /offline 화면과 그 화면의 CSS(/_next/static/…css)만 캐시에 넣어요.
// - 화면 열기(navigate · GET): 네트워크로 열고(미리 받기 켬), 네트워크가 안 되면 원래 주소 그대로 오프라인 안내를 보여요.
// - 그 밖 요청(API · RSC · 스크립트 · 사진)은 손대지 않아요. 오프라인 안내 CSS만 네트워크가 안 될 때 캐시에서 줘요.
// 등록은 운영에서만(components/site/SwRegister.tsx). 개발에서는 등록된 것을 지워 옛 화면이 남지 않아요.
// 응답 머리(늘 새로 받기 · 같은 주소 스크립트만)는 next.config.ts의 /sw.js 머리(B7)가 붙여요.
// 이 파일을 바꾸면 CACHE 이름의 판 번호를 올려요(옛 캐시는 activate 때 지워요).
const CACHE = "mj-offline-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(OFFLINE, { cache: "reload", credentials: "omit" });
      if (!res.ok) throw new Error("offline page " + res.status);
      const html = await res.clone().text();
      await cache.put(OFFLINE, res);
      const css = [...html.matchAll(/href="(\/_next\/static\/[^"?#]+\.css)"/g)].map((m) => m[1]);
      await cache.addAll([...new Set(css)]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          return preload || (await fetch(req));
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(OFFLINE)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (req.destination === "style" && new URL(req.url).pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req, { cacheName: CACHE })) || Response.error()),
    );
  }
});
