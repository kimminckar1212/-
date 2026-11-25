"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Loading } from "./ui";
import { TimetableGrid } from "./TimetableGrid";

/** 현재(또는 가장 최근) 신청일정 */
export function useCurrentPeriod() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    supabase.from("application_periods").select("*").order("starts_at").then(({ data }) => { setPeriods(data ?? []); setLoaded(true); });
  }, []);
  const now = Date.now();
  const open = periods.find((p) => new Date(p.starts_at).getTime() <= now && now <= new Date(p.ends_at).getTime());
  const latest = open ?? [...periods].reverse().find((p) => new Date(p.starts_at).getTime() <= now) ?? periods[0];
  return { periods, open, current: latest, loaded };
}

export function MyTimetable({ studentNo }: { studentNo: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    supabase.from("v_student_timetable").select("*").eq("student_no", studentNo).then(({ data }) => setRows(data ?? []));
  }, [studentNo]);
  const term = rows?.[0] ? `${rows[0].school_year}학년도 ${rows[0].semester}학기` : "";
  return (
    <Card title={`개인 시간표 ${term}`} right={<span className="text-xs text-slate-400">확정 수강 배정 기준</span>}>
      {rows === null ? <Loading /> : rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">배정된 수업이 없습니다</p> : (
        <TimetableGrid slots={rows.map((r) => ({ day_of_week: r.day_of_week, period: r.period, title: r.subject_name, sub: `${r.room_no} · ${r.teacher_name}` }))} />
      )}
    </Card>
  );
}
