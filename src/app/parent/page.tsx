"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { Badge, Card, Table, Td } from "@/components/ui";
import { MyTimetable } from "@/components/StudentShared";
import { NoticeInbox } from "@/components/NoticeInbox";

const TABS = ["자녀 수강 현황", "가정통신문"] as const;

export default function ParentPage() {
  const profile = useProfile("학부모");
  const [tab, setTab] = useState<(typeof TABS)[number]>("자녀 수강 현황");
  const children = profile?.parent?.children ?? [];
  const [child, setChild] = useState<string>("");
  const sel = child || children[0]?.student_no;

  return (
    <Shell profile={profile} nav={{ title: "학부모 서비스", items: TABS, value: tab, onChange: (v) => setTab(v as (typeof TABS)[number]) }}>
      {tab === "자녀 수강 현황" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button key={c.student_no} onClick={() => setChild(c.student_no)}
                className={`rounded-[3px] border px-4 py-2.5 text-left text-sm transition ${sel === c.student_no ? "border-[#1f4e8c] bg-[#eef3fa]" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <div className="font-medium text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-500">{c.grade}학년 {c.class_no}반 {c.number}번 · {c.relation_type}</div>
              </button>
            ))}
            {children.length > 1 && <span className="self-center text-xs text-slate-400">다자녀 통합 조회</span>}
          </div>
          {sel && <ChildStatus key={sel} studentNo={sel} />}
          {sel && <MyTimetable key={"t" + sel} studentNo={sel} />}
        </div>
      )}
      {tab === "가정통신문" && profile && <NoticeInbox userId={profile.userId} />}
    </Shell>
  );
}

function ChildStatus({ studentNo }: { studentNo: string }) {
  const [enr, setEnr] = useState<any[] | null>(null);
  const [apps, setApps] = useState<any[] | null>(null);
  useEffect(() => {
    supabase.from("enrollments").select("*, sections(section_no, offered_courses(subjects(subject_name, credits)))")
      .eq("student_no", studentNo).then(({ data }) => setEnr(data ?? []));
    supabase.from("applications").select("*, application_periods(round), offered_courses(subjects(subject_name))")
      .eq("student_no", studentNo).in("status", ["신청", "재신청필요", "폐강", "추첨탈락"]).then(({ data }) => setApps(data ?? []));
  }, [studentNo]);
  const credits = (enr ?? []).reduce((s, e) => s + (e.sections.offered_courses.subjects.credits ?? 0), 0);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="확정 수강 배정" right={enr && <span className="text-xs text-slate-500">총 {credits}학점</span>}>
        <Table head={["과목", "분반", "배정 방식", "상태"]} loading={!enr} empty={!enr?.length}>
          {(enr ?? []).map((e) => (
            <tr key={e.enrollment_id}>
              <Td className="font-medium">{e.sections.offered_courses.subjects.subject_name}</Td>
              <Td>{e.sections.section_no}반</Td><Td className="text-xs">{e.method}</Td><Td><Badge>{e.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="확인이 필요한 신청">
        <Table head={["차수", "과목", "상태"]} loading={!apps} empty={!apps?.length}>
          {(apps ?? []).map((a) => (
            <tr key={a.application_id}>
              <Td>{a.application_periods.round}차{a.preference_rank ? ` · ${a.preference_rank}지망` : ""}</Td>
              <Td className="font-medium">{a.offered_courses.subjects.subject_name}</Td><Td><Badge>{a.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
