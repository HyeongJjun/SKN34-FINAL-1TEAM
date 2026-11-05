// 업체 정보 화면(시안 WVProfile)에만 쓰는 화면 말 · 표시 함수. 금액은 새로 계산하지 않고 형식만 바꾼다.
import { call, type Schemas } from "@/lib/backend/client";
import { won } from "@/lib/format";

export type Profile = Schemas["ProfileOut"];
export type ProfileBody = Schemas["ProfileIn"];
export type Prices = Schemas["PricesOut"];
export type PriceSet = Schemas["PriceSetOut"];
export type PriceFile = Schemas["PriceFileOut"];
export type Photo = Schemas["PortfolioOut"];
export type Trade = "dobae" | "mokgong";
export type Method = ProfileBody["contact_method"];
export type FaqKey = Schemas["FaqIn"]["key"];

/** 통째로 저장(PUT) */
export const put = <T,>(path: string, body: unknown) => call<T>("PUT", path, body);

export const TRADE_KEYS: Trade[] = ["dobae", "mokgong"];
export const TRADE_DESC: Record<Trade, string> = { dobae: "벽 · 천장 도배", mokgong: "천장 몰딩 · 걸레받이" };

export const METHODS: { key: Method; label: string }[] = [
  { key: "phone", label: "전화" },
  { key: "sms", label: "문자" },
  { key: "kakao", label: "카카오톡 채널" },
  { key: "web", label: "홈페이지 상담" },
];
const WAY: Record<Method, string> = { phone: "전화로 연락해요", sms: "문자 주시면 연락드려요", kakao: "카카오톡 채널로 상담해요", web: "홈페이지에서 상담해요" };

// 업체 자세히(WVendorDetail)의 '자주 묻는 5가지'와 같은 순서 · 이름
export const FAQS: { key: FaqKey; label: string; ph: string }[] = [
  { key: "process", label: "진행 순서", ph: "예: 전화로 날짜를 정해 실측하고, 이틀 안에 견적서를 보내요." },
  { key: "pricing", label: "견적 계산 방식", ph: "예: 벽 · 천장 면적(㎡)에 도배지 값과 시공비를 곱해요." },
  { key: "extra_cost", label: "추가금이 생기는 경우", ph: "예: 실측 때 안 보이던 곰팡이가 나오면 먼저 알리고 동의를 받아요." },
  { key: "duration", label: "공사 기간", ph: "예: 32평 빈 집이면 보통 3일이에요." },
  { key: "as_refund", label: "A/S · 환불", ph: "예: 공사가 끝난 날부터 1년 A/S해요." },
];

export const CALL_START = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00"];
export const CALL_END = ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];

/** 고객에게 보이는 실측 방식 한 줄: "전화로 연락해요 · 통화 09:00~18:00 · 실측 무료" */
export function contactLine(m: Method, start: string, end: string, fee: number) {
  const parts = [WAY[m]];
  if (start && end) parts.push(`통화 ${start}~${end}`);
  parts.push(fee > 0 ? `출장비 ${won(fee)}` : "실측 무료");
  return parts.join(" · ");
}

/** "2148603518" → "214-86-03518" */
export function bizNoText(v: string | null) {
  if (!v) return "";
  return /^\d{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : v;
}

/** 근거 파일 종류 이름 */
export function fileKind(contentType: string) {
  if (contentType === "application/pdf") return "PDF";
  if (contentType.includes("spreadsheetml")) return "엑셀";
  if (contentType.startsWith("image/")) return "사진";
  return "파일";
}

/** 숫자만 남긴다(넣는 칸). "6,650원" → "6650" */
export const digits = (v: string) => v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 8);
/** 넣는 칸에 보일 모양: "6650" → "6,650" */
export const digitsText = (v: string) => (v ? Number(v).toLocaleString("ko-KR") : "");

// 서버가 받는 형식 · 크기 (backend/app/files/service.py RULES). 형식은 서버가 파일 앞부분으로 다시 확인한다.
export const PRICE_DOC = { accept: ".pdf,.xlsx,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic", ext: /\.(pdf|xlsx|jpe?g|png|heic|heif)$/i, mb: 20 };
export const WORK_PHOTO = { accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", ext: /\.(jpe?g|png|webp)$/i, mb: 10 };

/** 고르기 전에 이름 · 크기로 한 번 거른다. 통과하면 null */
export function fileProblem(f: File, rule: { ext: RegExp; mb: number }, typeMsg: string) {
  if (!rule.ext.test(f.name)) return typeMsg;
  if (f.size > rule.mb * 1024 * 1024) return `${rule.mb}MB까지 올릴 수 있어요.`;
  if (!f.size) return "빈 파일이에요.";
  return null;
}
