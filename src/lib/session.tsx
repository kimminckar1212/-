"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

export type Role = "학생" | "교사" | "학부모";
export type Profile = {
  userId: string; name: string; email: string; role: Role;
  student?: { student_no: string; grade: number; class_no: number; number: number };
  teacher?: { teacher_no: string; subject_area: string; department: string; isSenior: boolean };
  parent?: { parent_no: number; children: { student_no: string; name: string; grade: number; class_no: number; number: number; relation_type: string }[] };
};

export const homeOf = (r: Role) => (r === "학생" ? "/student" : r === "교사" ? "/teacher" : "/parent");

export async function loadProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const uid = session.user.id;
  const { data: u } = await supabase.from("users").select("*").eq("user_id", uid).maybeSingle();
  if (!u) return null;
  const p: Profile = { userId: uid, name: u.name, email: u.email, role: u.user_type };
  if (p.role === "학생") {
    const { data } = await supabase.from("students").select("*").eq("user_id", uid).single();
    p.student = data;
  } else if (p.role === "교사") {
    const { data } = await supabase.from("teachers").select("*, senior_teachers(teacher_no)").eq("user_id", uid).single();
    const st = data?.senior_teachers;
    p.teacher = { ...data, isSenior: Array.isArray(st) ? st.length > 0 : !!st };
  } else {
    const { data: pa } = await supabase.from("parents").select("parent_no").eq("user_id", uid).single();
    const { data: g } = await supabase.from("guardianships")
      .select("student_no, relation_type, students(grade, class_no, number, users(name))")
      .eq("parent_no", pa?.parent_no).order("student_no");
    p.parent = {
      parent_no: pa?.parent_no,
      children: (g ?? []).map((x: any) => ({
        student_no: x.student_no, relation_type: x.relation_type, name: x.students.users.name,
        grade: x.students.grade, class_no: x.students.class_no, number: x.students.number,
      })),
    };
  }
  return p;
}

/** 로그인·역할 확인. 다른 역할 페이지로 들어오면 자기 홈으로 보냄 */
export function useProfile(expected: Role) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();
  useEffect(() => {
    loadProfile().then((p) => {
      if (!p) return router.replace("/login");
      if (p.role !== expected) return router.replace(homeOf(p.role));
      setProfile(p);
    });
  }, [expected, router]);
  return profile;
}
