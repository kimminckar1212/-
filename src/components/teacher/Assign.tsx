"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { Badge, Button, Card, fmtDT, Table, Td, useFlash } from "../ui";

/** 신청일정별 접수 현황 · 1·2차 배정 · 3차 추첨 */
export function Assign() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [result, setResult] = useState<any[] | null>(null);
  const flash = useFlash();

  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const { data: p } = await supabase.from("application_periods").select("*").order("starts_at");
    setPeriods(p ?? []);
    const { data: a } = await supabase.from("applications")
      .select("application_id, period_id, student_no, preference_rank, status, applied_at, students(users(name)), offered_courses(subjects(subject_name))")
      .order("student_no").order("preference_rank");
    setApps(a ?? []);
    if (sel === null && p?.length) {
      const now = Date.now();
      setSel((p.find((x) => new Date(x.starts_at).getTime() <= now && now <= new Date(x.ends_at).getTime()) ?? p[p.length - 1]).period_id);
    }
    setLoaded(true);
  }, [sel]);
  useEffect(() => { load(); }, [load]);

  const period = periods.find((p) => p.period_id === sel);
  const list = apps.filter((a) => a.period_id === sel);
  const count = (s: string) => list.filter((a) => a.status === s).length;

  const run = async () => {
    flash.clear(); setResult(null);
    if (period.round === 3) {
      const { data, error } = await supabase.rpc("run_lottery", { p_period: period.period_id });
      if (error) return flash.fail(errMsg(error));
      setResult(data); flash.ok("3차 추첨을 실행했습니다. 정원 초과 과목은 무작위 추첨, 탈락자는 다음 지망으로 배정되었습니다.");
    } else {
      const { data, error } = await supabase.rpc("assign_applications", { p_period: period.period_id });
      if (error) return flash.fail(errMsg(error));
      flash.ok(`배정 완료 ${data?.[0]?.assigned ?? 0}건 / 재신청 필요 ${data?.[0]?.failed ?? 0}건`);
    }
    load();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {periods.map((p) => {
          const now = Date.now(); const open = new Date(p.starts_at).getTime() <= now && now <= new Date(p.ends_at).getTime();
          return (
            <button key={p.period_id} onClick={() => { setSel(p.period_id); setResult(null); flash.clear(); }}
              className={`rounded-[3px] border p-4 text-left transition ${sel === p.period_id ? "border-[#1f4e8c] bg-[#eef3fa]" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{p.school_year}-{p.semester} {p.round}차 {p.round === 3 ? "(추첨)" : ""}</span>
                {open ? <Badge tone="배정완료">접수 중</Badge> : <Badge tone="확인완료">{new Date(p.ends_at).getTime() < now ? "마감" : "예정"}</Badge>}
              </div>
              <div className="mt-1 text-xs text-slate-500">{fmtDT(p.starts_at)} ~ {fmtDT(p.ends_at)}</div>
              <div className="mt-1 text-xs text-slate-500">신청 {apps.filter((a) => a.period_id === p.period_id).length}건</div>
            </button>
          );
        })}
      </div>
      {flash.view}
      {period && (
        <Card title={`${period.round}차 신청 처리`}
          right={<Button onClick={run}>{period.round === 3 ? "추첨 실행 (1→2→3지망)" : "신청 배정 실행"}</Button>}>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {["신청", "확인완료", "배정완료", "추첨탈락", "재신청필요", "폐강"].map((s) => <Badge key={s} tone={s}>{s} {count(s)}</Badge>)}
          </div>
          {result && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              {result.map((r: any) => (
                <div key={r.rank} className="rounded-[3px] border border-slate-200 p-3 text-sm">
                  <div className="text-xs text-slate-500">{r.rank}지망 처리</div>
                  <div><b className="text-emerald-700">배정 {r.assigned}</b> · <span className="text-rose-600">탈락 {r.dropped}</span></div>
                </div>
              ))}
            </div>
          )}
          <Table head={["학번", "이름", "과목", "희망 순위", "신청 일시", "상태"]} loading={!loaded} empty={!list.length}>
            {list.map((a) => (
              <tr key={a.application_id}>
                <Td>{a.student_no}</Td><Td className="font-medium">{a.students?.users?.name}</Td>
                <Td>{a.offered_courses.subjects.subject_name}</Td><Td>{a.preference_rank ? `${a.preference_rank}지망` : "-"}</Td>
                <Td className="text-xs">{fmtDT(a.applied_at)}</Td><Td><Badge>{a.status}</Badge></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
