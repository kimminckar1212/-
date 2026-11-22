"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TeacherInfo = { teacher_no: string; name: string; isSenior: boolean; isJunior: boolean; department: string };

/** 교사 목록 (이름·선임/후임 구분) */
export function useTeachers() {
  const [list, setList] = useState<TeacherInfo[]>([]);
  useEffect(() => {
    supabase.from("teachers").select("teacher_no, department, users(name), senior_teachers(teacher_no), junior_teachers(teacher_no)")
      .order("teacher_no").then(({ data }) => setList((data ?? []).map((t: any) => ({
        teacher_no: t.teacher_no, name: t.users?.name ?? t.teacher_no, department: t.department,
        isSenior: Array.isArray(t.senior_teachers) ? t.senior_teachers.length > 0 : !!t.senior_teachers,
        isJunior: Array.isArray(t.junior_teachers) ? t.junior_teachers.length > 0 : !!t.junior_teachers,
      }))));
  }, []);
  const name = (no?: string | null) => list.find((t) => t.teacher_no === no)?.name ?? no ?? "-";
  return { list, name };
}

/** 가장 최근 개설 학기 */
export function useLatestTerm() {
  const [term, setTerm] = useState<{ school_year: number; semester: number } | null>(null);
  useEffect(() => {
    supabase.from("offered_courses").select("school_year, semester").order("school_year", { ascending: false })
      .order("semester", { ascending: false }).limit(1).then(({ data }) => data?.[0] && setTerm(data[0]));
  }, []);
  return term;
}
