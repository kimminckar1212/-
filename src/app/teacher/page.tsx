"use client";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { Tabs } from "@/components/ui";
import { Courses } from "@/components/teacher/Courses";
import { Counsel } from "@/components/teacher/Counsel";
import { Assign } from "@/components/teacher/Assign";
import { Schedule } from "@/components/teacher/Schedule";
import { Notices } from "@/components/teacher/Notices";
import { Approvals } from "@/components/teacher/Approvals";
import { Stats } from "@/components/teacher/Stats";

const TABS = ["개설·폐강", "누락·상담", "배정·추첨", "시간표", "가정통신문", "결재함", "현황·통계"] as const;
type Tab = (typeof TABS)[number];

export default function TeacherPage() {
  const profile = useProfile("교사");
  const t = profile?.teacher;
  const [tab, setTab] = useState<Tab | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!t) return;
    supabase.from("approvals").select("doc_no", { count: "exact", head: true }).eq("teacher_no", t.teacher_no).eq("status", "검토")
      .then(({ count }) => setPending(count ?? 0));
  }, [t, tab]);

  // 부장교사는 결재함, 일반교사는 개설·폐강부터
  const current: Tab = tab ?? (t?.isSenior ? "결재함" : "개설·폐강");
  const labels = TABS.map((x) => (x === "결재함" && pending ? (`결재함 (${pending})` as Tab) : x));

  return (
    <Shell profile={profile}>
      {t && (
        <>
          <Tabs tabs={labels} value={labels[TABS.indexOf(current)]} onChange={(v) => setTab(TABS[labels.indexOf(v)])} />
          {current === "개설·폐강" && <Courses teacherNo={t.teacher_no} />}
          {current === "누락·상담" && <Counsel teacherNo={t.teacher_no} />}
          {current === "배정·추첨" && <Assign />}
          {current === "시간표" && <Schedule />}
          {current === "가정통신문" && <Notices teacherNo={t.teacher_no} department={t.department} isJunior={!t.isSenior} />}
          {current === "결재함" && <Approvals teacherNo={t.teacher_no} />}
          {current === "현황·통계" && <Stats />}
        </>
      )}
    </Shell>
  );
}
