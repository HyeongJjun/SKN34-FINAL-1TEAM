"use client";
// 서비스 워커 등록(dev-01): 운영에서만 /sw.js를 등록해요(오프라인 안내 한 장만, 화면 · API는 캐시하지 않아요).
// 개발에서는 예전에 등록된 워커가 옛 화면을 붙잡지 않게 지워요.
import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => undefined);
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
