"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { Badge, Button, Card, Field, inputCls, Table, Td, useFlash } from "../ui";
import { useLatestTerm, useTeachers } from "./common";

/** 개설과목 현황 + 폐강 판단(사유 필수) */
export function Courses({ teacherNo }: { teacherNo: string }) {
  const term = useLatestTerm();
  const { name } = useTeachers();
  const [rows, setRows] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [target, setTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ result: "개설", willing: true, reason: "" });
  const flash = useFlash();

  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!term) return;
    const { data } = await supabase.from("v_offering_status").select("*").eq("school_year", term.school_year).eq("semester", term.semester).order("subject_code");
    setRows(data ?? []);
    const { data: d } = await supabase.from("closure_decisions").select("*, offered_courses!inner(school_year, semester, subjects(subject_name))")
      .eq("offered_courses.school_year", term.school_year).eq("offered_courses.semester", term.semester).order("decision_id", { ascending: false });
    setDecisions(d ?? []);
    setLoaded(true);
  }, [term]);
  useEffect(() => { load(); }, [load]);

  const decide = async () => {
    const { error } = await supabase.from("closure_decisions").insert({
      teacher_no: teacherNo, offering_id: target.offering_id, applicant_count: target.applicant_count,
      threshold: target.closing_threshold, is_small_class: target.is_small_class, teacher_willing: form.willing,
      result: form.result, reason: form.reason,
    });
    if (error) return flash.fail(errMsg(error));
    flash.ok(`${target.subject_name}: ${form.result} 판단을 기록했습니다.${form.result === "폐강" ? " 해당 과목 신청은 '폐강' 상태로 바뀌었습니다." : ""}`);
    setTarget(null); setForm({ result: "개설", willing: true, reason: "" }); load();
  };

  return (
    <div className="space-y-5">
      {flash.view}
      <Card title={`개설 과목 현황 ${term ? `(${term.school_year}학년도 ${term.semester}학기)` : ""}`}>
        <Table head={["과목", "구분", "신청 인원", "정원", "배정", "폐강 기준", "상태", ""]} loading={!loaded} empty={!rows.length}>
          {rows.map((o) => {
            const under = o.applicant_count <= o.closing_threshold;
            return (
              <tr key={o.offering_id}>
                <Td className="text-left"><div className="font-medium">{o.subject_name}</div>
                  <div className="flex gap-1 text-xs text-slate-400">{o.subject_code}{o.is_small_class && <Badge tone="결재중">소인수</Badge>}{o.is_required && <Badge tone="폐강">필수</Badge>}</div></Td>
                <Td className="text-xs">{o.subject_category}</Td>
                <Td><span className={under ? "font-semibold text-rose-600" : ""}>{o.applicant_count}명</span>{under && <div className="text-[11px] text-rose-500">폐강 기준 해당</div>}</Td>
                <Td>{o.total_capacity}</Td><Td>{o.enrolled_count}</Td>
                <Td className="text-xs">{o.closing_threshold}명 이하</Td>
                <Td><Badge>{o.status}</Badge></Td>
                <Td><Button small variant={under ? "primary" : "secondary"} onClick={() => { setTarget(o); flash.clear(); }}>폐강 판단</Button></Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {target && (
        <Card title={`폐강 판단 기록 — ${target.subject_name}`} right={<Button small variant="ghost" onClick={() => setTarget(null)}>닫기</Button>}>
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-[3px] bg-slate-50 p-3 text-sm md:grid-cols-4">
            <div><span className="text-xs text-slate-500">신청 인원</span><div className="font-medium">{target.applicant_count}명</div></div>
            <div><span className="text-xs text-slate-500">폐강 기준</span><div className="font-medium">{target.closing_threshold}명 이하</div></div>
            <div><span className="text-xs text-slate-500">소인수 교과</span><div className="font-medium">{target.is_small_class ? "예" : "아니오"}</div></div>
            <div><span className="text-xs text-slate-500">판단 교사</span><div className="font-medium">{name(teacherNo)}</div></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="판단 결과">
              <select className={inputCls} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                <option>개설</option><option>폐강</option>
              </select>
            </Field>
            <Field label="담당 교사 진행 의사">
              <select className={inputCls} value={form.willing ? "1" : "0"} onChange={(e) => setForm({ ...form, willing: e.target.value === "1" })}>
                <option value="1">있음</option><option value="0">없음</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="판단 사유 (필수 — 학생·학부모에게 공개되는 근거)">
              <textarea className={inputCls} rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="예) 신청 4명으로 폐강 기준 이하이나 소인수 교과이며 담당 교사 진행 의사가 있어 예외 개설" />
            </Field>
          </div>
          <div className="mt-4"><Button onClick={decide}>판단 기록 저장</Button></div>
        </Card>
      )}

      <Card title="폐강 판단 이력">
        <Table head={["판단일", "과목", "신청/기준", "소인수", "교사 의사", "결과", "사유", "판단 교사"]} loading={!loaded} empty={!decisions.length}>
          {decisions.map((d) => (
            <tr key={d.decision_id}>
              <Td className="text-xs">{d.decided_on}</Td><Td className="font-medium">{d.offered_courses.subjects.subject_name}</Td>
              <Td>{d.applicant_count} / {d.threshold}</Td><Td>{d.is_small_class ? "예" : "-"}</Td><Td>{d.teacher_willing ? "있음" : "없음"}</Td>
              <Td><Badge>{d.result}</Badge></Td><Td className="max-w-xs text-xs text-slate-600">{d.reason}</Td><Td>{name(d.teacher_no)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
