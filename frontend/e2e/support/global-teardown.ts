// 시험이 끝난 뒤 (B8): 기준 사본을 지워요. 시험 DB(mitjip_v3_e2e)는 리드 도구처럼 남겨 둬요(다음 시작 때 새로 복사).
import { dropBase } from "./db";

export default async function globalTeardown(): Promise<void> {
  dropBase();
}
