// 화면이 같이 쓰는 타입. API 응답 모양은 lib/backend/schema.d.ts(OpenAPI에서 만든 것)를 쓴다.

export type Role = "customer" | "vendor" | "admin";
// vendorStatus: 업체 회원만 pending(승인 대기) · approved · rejected
/** 로그인한 사람(GET /me). phone은 고객 휴대폰(업체 연락처는 업체 정보), joinedAt은 가입한 때(ISO) */
export interface Session { id: string; email: string; name: string; role: Role; vendorStatus: string | null; vendorRejectReason: string | null; phone: string | null; joinedAt: string }

/** 관리자 회원 목록 한 줄 (예시 데이터, 회원 API가 생기면 바꾼다) */
export interface Member { id: string; name: string; email: string; joinedAt: string; projects: number; status: "active" | "suspended"; role: Role }
