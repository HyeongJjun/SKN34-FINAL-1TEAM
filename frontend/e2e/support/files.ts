// 시험 파일 돕기 (B8): e2e/assets 경로 · 사진 위치 정보(GPS EXIF) 확인.
import path from "node:path";
import { FRONTEND_DIR } from "./env";

/** e2e/assets 안 시험 파일(위치 정보가 든 벽 사진 2장 · 작은 PDF 2개, 실제 집 사진이 아니에요) */
export const asset = (name: string): string => path.join(FRONTEND_DIR, "e2e", "assets", name);

/** JPEG의 Exif(APP1) 첫 IFD에 GPS 칸(0x8825)이 있는지 */
export function hasGpsExif(b: Buffer): boolean {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = b.readUInt16BE(i + 2);
    if (marker === 0xe1 && b.subarray(i + 4, i + 10).toString("latin1") === "Exif\0\0") {
      const t = i + 10;
      const le = b.subarray(t, t + 2).toString("latin1") === "II";
      const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
      const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
      const ifd0 = t + u32(t + 4);
      const n = u16(ifd0);
      for (let k = 0; k < n; k++) if (u16(ifd0 + 2 + k * 12) === 0x8825) return true;
    }
    i += 2 + len;
  }
  return false;
}
