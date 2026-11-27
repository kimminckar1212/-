"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge, Card, Loading, Stat, Table, Td } from "../ui";
import { useLatestTerm } from "./common";

/** 결재권자 현황: 과목별 개설·폐강, 통신문 열람·응답률 */
export function Stats() {
  const term = useLatestTerm();
  const [off, setOff] = useState<any[] | null>(null);
  const [ns, setNs] = useState<any[] | null>(null);
  const [missing, setMissing] = useState<number | null>(null);
  useEffect(() => {
    if (!term) return;
    supabase.from("v_offering_status").select("*").eq("school_year", term.school_year).eq("semester", term.semester).order("subject_code").then(({ data }) => setOff(data ?? []));
    supabase.from("v_notice_stats").select("*").order("doc_no", { ascending: false }).then(({ data }) => setNs(data ?? []));
    supabase.from("v_missing_required").select("student_no").then(({ data }) => setMissing(new Set((data ?? []).map((d) => d.student_no)).size));
  }, [term]);
  if (!off || !ns || missing === null) return <Card><Loading text="현황을 불러오는 중…" /></Card>;
  const opened = off.filter((o) => o.status === "개설").length;
  const closed = off.filter((o) => o.status === "폐강").length;
  const enrolled = off.reduce((s, o) => s + o.enrolled_count, 0);
  const cap = off.reduce((s, o) => s + (o.status === "폐강" ? 0 : o.total_capacity), 0);
  const posted = ns.filter((n) => n.status === "게시" && n.has_survey);
  const avgRate = posted.length ? (posted.reduce((s, n) => s + Number(n.response_rate), 0) / posted.length).toFixed(1) : "-";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="개설 / 폐강 과목" value={`${opened} / ${closed}`} sub={term ? `${term.school_year}학년도 ${term.semester}학기` : ""} />
        <Stat label="전체 과목 배정 건수 / 총 정원" value={`${enrolled} / ${cap}`} sub="과목별 배정 합계 (학생 수 아님)" />
        <Stat label="필수 이수 누락 학생" value={`${missing}명`} sub="상담 필요" />
        <Stat label="설문 평균 응답률" value={`${avgRate}%`} sub={`게시된 설문 ${posted.length}건`} />
      </div>
      <Card title="과목별 개설·폐강 현황">
        <Table head={["과목", "신청", "배정 / 정원", "충원율", "상태"]} empty={!off.length}>
          {off.map((o) => {
            const pct = o.total_capacity ? Math.round((100 * o.enrolled_count) / o.total_capacity) : 0;
            return (
              <tr key={o.offering_id}>
                <Td className="font-medium">{o.subject_name}</Td><Td>{o.applicant_count}</Td><Td>{o.enrolled_count} / {o.total_capacity}</Td>
                <Td><div className="flex items-center gap-2"><div className="h-2 w-28 rounded bg-slate-100"><div className="h-2 rounded bg-[#1f4e8c]" style={{ width: `${Math.min(pct, 100)}%` }} /></div><span className="text-xs text-slate-500">{pct}%</span></div></Td>
                <Td><Badge>{o.status}</Badge></Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card title="가정통신문 열람·응답 현황">
        <Table head={["문서", "상태", "수신", "열람", "응답", "응답률", "회신 기한"]} empty={!ns.length}>
          {ns.map((n) => (
            <tr key={n.doc_no}>
              <Td className="font-medium">{n.doc_no}호 {n.title}</Td><Td><Badge>{n.status}</Badge></Td>
              <Td>{n.recipient_count}</Td><Td>{n.read_count}</Td><Td>{n.has_survey ? n.response_count : "-"}</Td>
              <Td>{n.has_survey ? `${n.response_rate}%` : "-"}</Td><Td className="text-xs">{n.reply_deadline ?? "-"}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
