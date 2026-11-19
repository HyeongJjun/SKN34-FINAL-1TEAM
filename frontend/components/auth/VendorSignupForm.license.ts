// 사업자등록증 파일 규칙(업체 가입 V01 · 보완 V14 · 다시 신청이 같이 써요). 서버 규칙과 같게(backend/app/files/service.py RULES["license"]).
// 화면은 고른 파일을 미리 걸러 주기만 하고, 형식 · 크기 · 위치 정보 지우기는 서버가 다시 해요.
import { ApiError } from "@/lib/backend/client";

export const LICENSE_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const LICENSE_MB = 10;
export const LICENSE_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
const FILE_CODES = ["file_type", "file_too_big", "file_broken", "file_empty", "file_kind", "file"];

/** 고른 파일을 미리 봐요(서버가 다시 검사해요) */
export function licenseError(f: File): string | null {
  if (!f.size) return "빈 파일이에요. 다른 파일을 골라 주세요.";
  const okType = f.type ? LICENSE_TYPES.includes(f.type) : /\.(jpe?g|png|pdf)$/i.test(f.name);
  if (!okType) return "PDF · 사진(JPG · PNG)만 올릴 수 있어요.";
  if (f.size > LICENSE_MB * 1024 * 1024) return `${LICENSE_MB}MB까지 올릴 수 있어요.`;
  return null;
}
/** 파일 오류 코드면 파일 칸에 보일 문장, 아니면 null */
export function fileErrorText(e: unknown): string | null {
  return e instanceof ApiError && FILE_CODES.includes(e.code) ? e.message : null;
}
/** 사진이면 서버가 위치 정보를 지운 뒤라 '위치 정보 지움'을 붙여요(PDF는 붙이지 않아요) */
export const isImage = (type: string | null | undefined, name: string) => (type ? type.startsWith("image/") : /\.(jpe?g|png|heic|webp)$/i.test(name));
