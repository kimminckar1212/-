"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { homeOf, loadProfile } from "@/lib/session";
import { Alert, Button, Field, inputCls } from "@/components/ui";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-sky-50 p-6">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 font-bold text-white">무명</div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">학교 통합 관리 시스템</h1>
              <p className="text-xs text-slate-500">수강신청 · 시간표 · 가정통신문 · 결재</p>
            </div>
          </div>
          <form onSubmit={signIn} className="space-y-4">
            <Field label="이메일"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.example" /></Field>
            <Field label="비밀번호"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" disabled={busy || !email || !password}>{busy ? "로그인 중…" : "로그인"}</Button>
          </form>
          <p className="mt-6 text-xs leading-relaxed text-slate-400">
            Supabase Auth로 로그인하며, 로그인한 사용자 구분(학생·학부모·교사)에 따라 행 수준 보안(RLS)이 적용되어 볼 수 있는 데이터가 달라집니다.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">시연 계정으로 바로 로그인</h2>
          <p className="mb-4 text-xs text-slate-500">비밀번호는 모두 <code className="rounded bg-slate-100 px-1">test1234</code></p>
          <div className="space-y-4">
            {DEMO.map((g) => (
              <div key={g.group}>
                <div className="mb-1.5 text-xs font-medium text-slate-500">{g.group}</div>
                <div className="grid grid-cols-2 gap-2">
                  {g.items.map((d) => (
                    <button key={d.email} disabled={busy} onClick={() => signIn(undefined, d.email, "test1234")}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-700 transition hover:border-teal-500 hover:bg-teal-50 disabled:opacity-50">
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
