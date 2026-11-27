"use client";
import { ReactNode, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/session";

export type Nav = { title: string; items: readonly string[] | string[]; value: string; onChange: (v: string) => void; badge?: Record<string, number> };

const roleMenu: Record<string, string> = { 학생: "학생 서비스", 교사: "교무 업무", 학부모: "학부모 서비스" };

export function Shell({ profile, nav, children }: { profile: Profile | null; nav?: Nav; children: ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  // 로그아웃: 세션 삭제 후 전체 새로고침으로 이동 → 이전 계정의 화면 상태가 남지 않음
  const logout = async () => {
    setLeaving(true);
    try { await supabase.auth.signOut(); } finally { window.location.replace("/login"); }
  };
  const sub = profile?.student ? `${profile.student.grade}학년 ${profile.student.class_no}반 ${profile.student.number}번 · ${profile.student.student_no}`
    : profile?.teacher ? `${profile.teacher.department} · ${profile.teacher.isSenior ? "부장교사" : "교사"} · ${profile.teacher.teacher_no}`
    : profile?.parent ? `${profile.parent.children.map((c) => c.name).join(", ")} 보호자` : "";

  return (
    <div className="flex min-h-screen flex-col bg-[#eef1f5] text-[#1b2a3d]">
      {/* 상단 기관 헤더 */}
      <header className="bg-[#173d6e] text-white">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 bg-white text-[13px] font-extrabold text-[#173d6e]">한빛</div>
            <div className="leading-tight">
              <div className="whitespace-nowrap text-[15px] font-bold tracking-tight md:text-[16px]">한빛고등학교 <span className="hidden font-normal text-white/80 sm:inline">학사행정시스템</span></div>
              <div className="hidden text-[11px] text-white/60 sm:block">수강신청 · 시간표 · 가정통신문 · 전자결재</div>
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-2 whitespace-nowrap text-[12px] md:gap-3">
              <span className="hidden rounded-[2px] bg-white/15 px-2 py-0.5 sm:inline">{profile.role}</span>
              <span><b className="text-[13px]">{profile.name}</b> 님</span>
              <span className="hidden text-white/60 md:inline">| {sub}</span>
              <button onClick={logout} disabled={leaving}
                className="ml-1 h-7 shrink-0 rounded-[3px] border border-white/50 px-3 text-[12px] hover:bg-white/10 disabled:opacity-50">로그아웃</button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-0 md:gap-5 md:px-5 md:py-5">
        {/* 좌측 메뉴 */}
        {profile && nav && (
          <aside className="hidden w-[210px] shrink-0 md:block">
            <div className="border border-[#d5dbe3] bg-white">
              <div className="bg-[#1f4e8c] px-4 py-3 text-[14px] font-bold text-white">{roleMenu[profile.role] ?? nav.title}</div>
              <ul>
                {nav.items.map((it) => {
                  const on = it === nav.value;
                  return (
                    <li key={it} className="border-b border-[#edf0f4] last:border-b-0">
                      <button onClick={() => nav.onChange(it)}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] transition ${on ? "bg-[#eef3fa] font-bold text-[#1f4e8c]" : "text-[#3a4756] hover:bg-[#f6f8fb]"}`}>
                        <span className="flex items-center gap-2"><span className={`text-[10px] ${on ? "text-[#1f4e8c]" : "text-[#b0b9c4]"}`}>▶</span>{it}</span>
                        {!!nav.badge?.[it] && <span className="rounded-[2px] bg-[#c62828] px-1.5 text-[11px] font-bold text-white">{nav.badge[it]}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-3 border border-[#d5dbe3] bg-white p-3 text-[11px] leading-relaxed text-[#6b7785]">
              <div className="mb-1 font-bold text-[#3a4756]">문의</div>
              교무기획부 ☎ 031-000-0000<br />평일 09:00 ~ 17:00
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 bg-white md:border md:border-[#d5dbe3]">
          {profile && nav && (
            <>
              {/* 모바일 메뉴 */}
              <div className="flex gap-1 overflow-x-auto border-b border-[#d5dbe3] bg-[#f6f8fb] px-2 md:hidden">
                {nav.items.map((it) => (
                  <button key={it} onClick={() => nav.onChange(it)}
                    className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] ${it === nav.value ? "border-[#1f4e8c] font-bold text-[#1f4e8c]" : "border-transparent text-[#5a6878]"}`}>{it}</button>
                ))}
              </div>
              <div className="border-b border-[#e3e8ee] px-6 pb-3 pt-5">
                <div className="mb-1 text-[11px] text-[#8793a1]">홈 › {roleMenu[profile.role]} › <span className="text-[#3a4756]">{nav.value}</span></div>
                <h1 className="text-[20px] font-bold tracking-tight text-[#1b2a3d]">{nav.value}</h1>
              </div>
            </>
          )}
          <div className="space-y-4 px-6 py-5">
            {profile ? children : <p className="py-20 text-center text-sm text-slate-400">불러오는 중…</p>}
          </div>
        </main>
      </div>

      <footer className="border-t border-[#d5dbe3] bg-white">
        <div className="mx-auto max-w-[1280px] px-5 py-3 text-[11px] text-[#8793a1]">
          한빛고등학교 학사행정시스템 · 기업 데이터베이스 설계 및 구현 2조 무명 · 시연용 가상 데이터
        </div>
      </footer>
    </div>
  );
}
