"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { homeOf, loadProfile } from "@/lib/session";
import { Alert, Field, inputCls } from "@/components/ui";

// 시연용 계정 (비밀번호 모두 test1234)
const DEMO = [
  { group: "학생", items: [
    { label: "강지민 (정상 배정)", email: "s20260001@school.example" },
    { label: "윤서연 (폐강→3차 추첨)", email: "s20260003@school.example" },
    { label: "한도윤 (기이수 과목 有)", email: "s20260004@school.example" },
    { label: "오하린 (필수과목 누락)", email: "s20260005@school.example" },
  ] },
  { group: "학부모", items: [
    { label: "강현주 (자녀 2명)", email: "p1@school.example" },
    { label: "오미경 (설문 미응답)", email: "p3@school.example" },
  ] },
  { group: "교사", items: [
    { label: "이수진 · 일반교사·담임", email: "t0002@school.example" },
    { label: "박민준 · 일반교사(1차 결재)", email: "t0003@school.example" },
    { label: "정하늘 · 일반교사·기안자", email: "t0005@school.example" },
    { label: "김영호 · 부장교사(결재)", email: "t0001@school.example" },
    { label: "최은정 · 부장교사(결재)", email: "t0004@school.example" },
  ] },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("학생");

  // 화면에 들어올 때마다 로그인 처리 상태 초기화 (이전 화면 상태 복원 대비)
  useEffect(() => { setBusy(false); setError(""); }, []);

  const signIn = async (e?: FormEvent, em = email, pw = password) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      // 다른 계정이 남아 있으면 먼저 정리
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) { setError("이메일 또는 비밀번호가 올바르지 않습니다."); return; }
      const p = await loadProfile();
      if (!p) { setError("사용자 정보가 등록되지 않은 계정입니다."); await supabase.auth.signOut(); return; }
      // 전체 새로고침으로 이동 → 역할별 화면을 항상 새 계정 기준으로 불러옴
      window.location.replace(homeOf(p.role));
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  };

  const groups = DEMO.map((g) => g.group);
  const demo = DEMO.find((g) => g.group === role) ?? DEMO[0];

  return (
    <div className="flex min-h-screen flex-col bg-[#eef1f5] text-[#1b2a3d]">
      <header className="bg-[#173d6e] text-white">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center gap-3 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 bg-white text-[13px] font-extrabold text-[#173d6e]">한빛</div>
          <div className="leading-tight">
            <div className="text-[16px] font-bold">한빛고등학교 <span className="font-normal text-white/80">학사행정시스템</span></div>
            <div className="text-[11px] text-white/60">수강신청 · 시간표 · 가정통신문 · 전자결재</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1080px] flex-1 content-start gap-5 px-5 py-8 md:grid-cols-[1fr_400px]">
        {/* 안내 영역 */}
        <div className="space-y-4">
          <div className="border border-[#d5dbe3] bg-gradient-to-r from-[#1f4e8c] to-[#2f64a8] px-6 py-7 text-white">
            <div className="text-[12px] text-white/70">2027학년도 고교학점제</div>
            <div className="mt-1 text-[22px] font-bold leading-snug">수강신청부터 가정통신문까지<br />한 곳에서 처리합니다</div>
            <div className="mt-3 text-[12px] text-white/80">학생·학부모·교직원 구분에 따라 이용할 수 있는 메뉴가 다릅니다.</div>
          </div>
          <div className="border border-[#d5dbe3] bg-white">
            <div className="flex items-center justify-between border-b border-[#e3e8ee] bg-[#fafbfc] px-4 py-2.5">
              <h2 className="flex items-center gap-2 text-[14px] font-bold"><span className="inline-block h-3.5 w-1 bg-[#1f4e8c]" />학사 일정</h2>
            </div>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-[#edf0f4]">
                {[
                  ["1차 수강신청 (희망 신청)", "11. 2. ~ 11. 6."],
                  ["2차 수강신청 (재신청)", "11. 9. ~ 11. 13."],
                  ["3차 수강신청 (1~3지망 추첨)", "11. 20. ~ 11. 30."],
                  ["고교학점제 학부모 설명회", "11. 27. 19:00"],
                ].map(([a, b]) => (
                  <tr key={a}><td className="px-4 py-2.5">{a}</td><td className="px-4 py-2.5 text-right text-[#5a6878]">{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 로그인 영역 */}
        <div className="border border-[#d5dbe3] bg-white">
          <div className="grid grid-cols-3 border-b border-[#d5dbe3]">
            {groups.map((g) => (
              <button key={g} onClick={() => setRole(g)}
                className={`py-3 text-[13px] font-bold ${role === g ? "border-b-2 border-[#1f4e8c] text-[#1f4e8c]" : "bg-[#f6f8fb] text-[#8793a1]"}`}>{g === "교사" ? "교직원" : g}</button>
            ))}
          </div>
          <div className="p-6">
            <form onSubmit={signIn} className="space-y-3">
              <Field label="아이디(이메일)"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.example" /></Field>
              <Field label="비밀번호"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              {error && <Alert>{error}</Alert>}
              <button type="submit" disabled={busy || !email || !password}
                className="h-11 w-full rounded-[3px] bg-[#1f4e8c] text-[14px] font-bold text-white hover:bg-[#173d6e] disabled:opacity-40">{busy ? "로그인 중…" : "로그인"}</button>
            </form>
            <div className="mt-6 border-t border-[#e3e8ee] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#3a4756]">시연 계정 ({role === "교사" ? "교직원" : role})</span>
                <span className="text-[11px] text-[#8793a1]">비밀번호 test1234</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {demo.items.map((d) => (
                  <button key={d.email} disabled={busy} onClick={() => signIn(undefined, d.email, "test1234")}
                    className="flex items-center justify-between rounded-[3px] border border-[#d5dbe3] px-3 py-2 text-left text-[12px] text-[#3a4756] hover:border-[#1f4e8c] hover:bg-[#eef3fa] disabled:opacity-50">
                    <span>{d.label}</span><span className="text-[#b0b9c4]">›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#d5dbe3] bg-white">
        <div className="mx-auto max-w-[1080px] px-5 py-3 text-[11px] text-[#8793a1]">
          한빛고등학교 학사행정시스템 · 기업 데이터베이스 설계 및 구현 2조 무명 · 시연용 가상 데이터
        </div>
      </footer>
    </div>
  );
}
