// 설치 아이콘(app/manifest.ts가 가리켜요): /icons/192.png · /icons/512.png · /icons/maskable-512.png
// 빌드 때 그려 두는 정적 PNG예요(그 밖 이름은 404). 아이콘을 바꾸면 하루 안에 새로 받아요.
import { markImage, type MarkKind } from "../mark";

export const dynamic = "force-static";
export const dynamicParams = false;

const ICONS: Record<string, { size: number; kind: MarkKind }> = {
  "192.png": { size: 192, kind: "any" },
  "512.png": { size: 512, kind: "any" },
  "maskable-512.png": { size: 512, kind: "maskable" },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((id) => ({ id }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const icon = ICONS[(await params).id];
  if (!icon) return new Response(null, { status: 404 });
  return markImage(icon.size, icon.kind, { "Cache-Control": "public, max-age=86400" });
}
