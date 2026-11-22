"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { Button, Card, Field, inputCls, Table, Td, useFlash } from "../ui";
import { DAYS, PERIODS, TimetableGrid } from "../TimetableGrid";
import { useLatestTerm, useTeachers } from "./common";

/** 시간표 편성 — 교실·교사·학생 중복은 DB 트리거가 차단 */
export function Schedule() {
  const term = useLatestTerm();
  const { name } = useTeachers();
  const [sections, setSections] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ section_id: "", room_no: "", day_of_week: "월", period: "1" });
  const flash = useFlash();

  const load = useCallback(async () => {
    if (!term) return;
    const { data: s } = await supabase.from("sections")
      .select("section_id, section_no, teacher_no, max_capacity, offered_courses!inner(school_year, semester, status, subjects(subject_name))")
      .eq("offered_courses.school_year", term.school_year).eq("offered_courses.semester", term.semester).order("section_id");
    const secs = (s ?? []).filter((x: any) => x.offered_courses.status !== "폐강");
    setSections(secs);
    const { data: t } = await supabase.from("timetables").select("*").in("section_id", secs.map((x: any) => x.section_id));
    setSlots(t ?? []);
    const { data: r } = await supabase.from("classrooms").select("*").order("room_no");
    setRooms(r ?? []);
  }, [term]);
  useEffect(() => { load(); }, [load]);

  const secOf = (id: number) => sections.find((s) => s.section_id === id);
  const label = (s: any) => `${s.offered_courses.subjects.subject_name} ${s.section_no}반`;
  const add = async () => {
    const { error } = await supabase.from("timetables").insert({
      section_id: Number(form.section_id), room_no: form.room_no, day_of_week: form.day_of_week, period: Number(form.period),
    });
    if (error) return flash.fail(`편성 불가: ${errMsg(error)}`);
    flash.ok("시간표에 추가했습니다. (충돌 없음)"); load();
  };
  const remove = async (id: number) => {
    const { error } = await supabase.from("timetables").delete().eq("timetable_id", id);
    if (error) flash.fail(errMsg(error)); else load();
  };

  const shown = slots.filter((t) => !filter || t.room_no === filter || secOf(t.section_id)?.teacher_no === filter);
  return (
    <div className="space-y-5">
      <Card title="수업 시간 추가">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="분반">
            <select className={inputCls} value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
              <option value="">선택</option>
              {sections.map((s) => <option key={s.section_id} value={s.section_id}>{label(s)} ({name(s.teacher_no)})</option>)}
            </select>
          </Field>
          <Field label="교실">
            <select className={inputCls} value={form.room_no} onChange={(e) => setForm({ ...form, room_no: e.target.value })}>
              <option value="">선택</option>
              {rooms.map((r) => <option key={r.room_no} value={r.room_no}>{r.room_no} {r.room_name}</option>)}
            </select>
          </Field>
          <Field label="요일">
            <select className={inputCls} value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="교시">
            <select className={inputCls} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
              {PERIODS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <div className="flex items-end"><Button onClick={add} disabled={!form.section_id || !form.room_no}>충돌 검사 후 추가</Button></div>
        </div>
        {flash.view && <div className="mt-4">{flash.view}</div>}
      </Card>

      <Card title={`전체 시간표 ${term ? `(${term.school_year}학년도 ${term.semester}학기)` : ""}`}
        right={
          <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">전체 보기</option>
            <optgroup label="교실별">{rooms.map((r) => <option key={r.room_no} value={r.room_no}>{r.room_no} {r.room_name}</option>)}</optgroup>
            <optgroup label="교사별">{[...new Set(sections.map((s) => s.teacher_no))].map((t) => <option key={t} value={t}>{name(t)}</option>)}</optgroup>
          </select>
        }>
        <TimetableGrid slots={shown.map((t) => {
          const s = secOf(t.section_id);
          return { day_of_week: t.day_of_week, period: t.period, title: s ? label(s) : String(t.section_id), sub: `${t.room_no} · ${name(s?.teacher_no)}`,
            extra: <button onClick={() => remove(t.timetable_id)} className="text-[10px] text-rose-500 hover:underline">삭제</button> };
        })} />
      </Card>

      <Card title="분반 계획">
        <Table head={["분반", "담당 교사", "최대 인원", "주당 시수(편성)"]} empty={!sections.length}>
          {sections.map((s) => (
            <tr key={s.section_id}>
              <Td className="font-medium">{label(s)}</Td><Td>{name(s.teacher_no)}</Td><Td>{s.max_capacity}</Td>
              <Td>{slots.filter((t) => t.section_id === s.section_id).length}시간</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
