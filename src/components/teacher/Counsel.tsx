"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { Badge, Button, Card, Field, fmtDT, inputCls, Table, Td, useFlash } from "../ui";
import { useLatestTerm, useTeachers } from "./common";

/** 필수 이수 누락자 자동 조회 + 상담 기록 */
export function Counsel({ teacherNo }: { teacherNo: string }) {
  const term = useLatestTerm();
  const { name } = useTeachers();
  const [missing, setMissing] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [form, setForm] = useState({ student_no: "", counsel_type: "필수이수누락", changed_offering_id: "", content: "" });
  const flash = useFlash();

  const load = useCallback(async () => {
    const [m, l, s] = await Promise.all([
      supabase.from("v_missing_required").select("*").order("student_no"),
      supabase.from("counselings").select("*, students(users(name)), offered_courses(subjects(subject_name))").order("counseled_at", { ascending: false }),
      supabase.from("students").select("student_no, users(name)").order("student_no"),
    ]);
    setMissing(m.data ?? []); setLogs(l.data ?? []); setStudents(s.data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!term) return;
    supabase.from("v_offering_status").select("offering_id, subject_name, status").eq("school_year", term.school_year).eq("semester", term.semester)
      .neq("status", "폐강").then(({ data }) => setOfferings(data ?? []));
  }, [term]);

  const startFor = (m: any) => {
    const off = offerings.find((o) => o.subject_name === m.subject_name);
    setForm({ student_no: m.student_no, counsel_type: "필수이수누락", changed_offering_id: off ? String(off.offering_id) : "",
      content: `필수 이수 과목 ${m.subject_name} 미신청 확인. ` });
    flash.clear();
  };
  const save = async () => {
    const { error } = await supabase.from("counselings").insert({
      teacher_no: teacherNo, student_no: form.student_no, counsel_type: form.counsel_type,
      changed_offering_id: form.changed_offering_id ? Number(form.changed_offering_id) : null, content: form.content,
    });
    if (error) return flash.fail(errMsg(error));
    flash.ok("상담 기록을 저장했습니다.");
    setForm({ student_no: "", counsel_type: "필수이수누락", changed_offering_id: "", content: "" }); load();
  };

  return (
    <div className="space-y-5">
      {flash.view}
      <Card title={`필수 이수 누락자 (${missing.length}명)`} right={<span className="text-xs text-slate-400">이수·신청·배정 어디에도 없는 필수 과목 자동 추출</span>}>
        <Table head={["학번", "이름", "학년/반/번호", "담임", "누락 과목", ""]} empty={!missing.length}>
          {missing.map((m) => (
            <tr key={m.student_no + m.subject_code}>
              <Td>{m.student_no}</Td><Td className="font-medium">{m.student_name}</Td>
              <Td>{m.grade}-{m.class_no}-{m.number}</Td><Td>{name(m.homeroom_teacher_no)}</Td>
              <Td><Badge tone="폐강">{m.subject_name}</Badge></Td>
              <Td><Button small onClick={() => startFor(m)}>상담 기록</Button></Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="상담 기록 작성">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="학생">
            <select className={inputCls} value={form.student_no} onChange={(e) => setForm({ ...form, student_no: e.target.value })}>
              <option value="">선택</option>
              {students.map((s) => <option key={s.student_no} value={s.student_no}>{s.student_no} {s.users?.name}</option>)}
            </select>
          </Field>
          <Field label="상담 구분">
            <select className={inputCls} value={form.counsel_type} onChange={(e) => setForm({ ...form, counsel_type: e.target.value })}>
              <option>필수이수누락</option><option>과목변경</option><option>기타</option>
            </select>
          </Field>
          <Field label="변경 대상 과목 (과목변경 시 필수)">
            <select className={inputCls} value={form.changed_offering_id} onChange={(e) => setForm({ ...form, changed_offering_id: e.target.value })}>
              <option value="">없음</option>
              {offerings.map((o) => <option key={o.offering_id} value={o.offering_id}>{o.subject_name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4"><Field label="상담 내용">
          <textarea className={inputCls} rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </Field></div>
        <div className="mt-4"><Button onClick={save} disabled={!form.student_no || !form.content}>저장</Button></div>
      </Card>

      <Card title="상담 기록" right={<span className="text-xs text-slate-400">내가 작성했거나 내가 담임인 학생의 상담만 표시됩니다</span>}>
        <Table head={["일시", "학생", "구분", "변경 과목", "내용", "교사"]} empty={!logs.length}>
          {logs.map((l) => (
            <tr key={l.counseling_id}>
              <Td className="text-xs">{fmtDT(l.counseled_at)}</Td><Td className="font-medium">{l.students?.users?.name}</Td>
              <Td><Badge tone="재신청필요">{l.counsel_type}</Badge></Td><Td>{l.offered_courses?.subjects?.subject_name ?? "-"}</Td>
              <Td className="max-w-sm text-xs text-slate-600">{l.content}</Td><Td>{name(l.teacher_no)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
