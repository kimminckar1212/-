import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key",
);

/** Supabase/PostgREST 오류를 사용자에게 보여줄 문장으로 변환 */
export function errMsg(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return "";
  const m = e.message ?? "알 수 없는 오류";
  if (m.includes("row-level security")) return "권한이 없습니다 (행 수준 보안 정책에 의해 차단)";
  if (m.includes("duplicate key")) return "이미 등록된 항목입니다 (중복 불가 제약)";
  const named: Record<string, string> = {
    approvals_check: "반려할 때는 반려 사유를 반드시 입력해야 합니다",
    closure_decisions_reason_check: "폐강 판단 사유는 필수입니다",
    counselings_check: "과목변경 상담은 변경 대상 과목을 선택해야 합니다",
    notices_check: "설문이 있으면 문항과 회신 기한을 입력해야 합니다",
  };
  const cname = m.match(/constraint "([^"]+)"/)?.[1];
  if (cname && named[cname]) return `${named[cname]} (DB 제약: ${cname})`;
  if (m.includes("violates check constraint")) return `입력값이 허용 범위를 벗어났습니다 (${m.match(/"([^"]+)"$/)?.[1] ?? "CHECK"})`;
  return m;
}
