"use client";
import { ReactNode, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/session";

export function Shell({ profile, children }: { profile: Profile | null; children: ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  // 로그아웃: 세션 삭제 후 전체 새로고침으로 이동 → 이전 계정의 화면 상태가 남지 않음
  const logout = async () => {
    setLeaving(true);
    try { await supabase.auth.signOut(); } finally { window.location.replace("/login"); }
  };
  const sub = profile?.student ? `${profile.student.student_no} · ${profile.student.grade}학년 ${profile.student.class_no}반 ${profile.student.number}번`
    : profile?.teacher ? `${profile.teacher.teacher_no} · ${profile.teacher.isSenior ? "부장교사(선임)" : "일반교사(후임)"} · ${profile.teacher.department}`
    : profile?.parent ? `자녀 ${profile.parent.children.map((c) => c.name).join(", ")}` : "";
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">무명</div>
            <div>
              <div className="text-sm font-semibold text-slate-800">학교 수강신청 · 가정통신문 통합 관리</div>
              <div className="text-xs text-slate-500">한빛고등학교 (시연용)</div>
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-slate-800">{profile.name} <span className="ml-1 rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">{profile.role}</span></div>
                <div className="text-xs text-slate-500">{sub}</div>
              </div>
              <button onClick={logout} disabled={leaving} className="rounded-lg disabled:opacity-50 border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">로그아웃</button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        {profile ? children : <p className="py-20 text-center text-sm text-slate-400">불러오는 중…</p>}
      </main>
    </div>
  );
}
