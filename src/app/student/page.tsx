"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProfile } from "@/lib/session";
import { errMsg, supabase } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { Alert, Badge, Button, Card, fmtDT, Table, Tabs, Td, useFlash } from "@/components/ui";
import { MyTimetable, useCurrentPeriod } from "@/components/StudentShared";
import { NoticeInbox } from "@/components/NoticeInbox";

const TABS = ["수강신청", "신청·배정 내역", "내 시간표", "가정통신문"] as const;

export default function StudentPage() {
  const profile = useProfile("학생");
  const [tab, setTab] = useState<(typeof TABS)[number]>("수강신청");
  return (
    <Shell profile={profile}>
      {profile?.student && (
        <>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          {tab === "수강신청" && <Apply studentNo={profile.student.student_no} />}
          {tab === "신청·배정 내역" && <History studentNo={profile.student.student_no} />}
          {tab === "내 시간표" && <MyTimetable studentNo={profile.student.student_no} />}
          {tab === "가정통신문" && <NoticeInbox userId={profile.userId} />}
        </>
      )}
    </Shell>
  );
}

function Apply({ studentNo }: { studentNo: string }) {
  const { open, current } = useCurrentPeriod();
  const [offerings, setOfferings] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [missing, setMissing] = useState<any[]>([]);
  const [rank, setRank] = useState<Record<number, number>>({});
  const flash = useFlash();

  const load = useCallback(async () => {
    if (!current) return;
    const [o, a, c, m] = await Promise.all([
      supabase.from("v_offering_status").select("*").eq("school_year", current.school_year).eq("semester", current.semester).order("subject_code"),
      supabase.from("applications").select("*, application_periods(round)").eq("student_no", studentNo),
      supabase.from("completions").select("subject_code").eq("student_no", studentNo),
      supabase.from("v_missing_required").select("*").eq("student_no", studentNo),
    ]);
    setOfferings(o.data ?? []); setMine(a.data ?? []);
    setCompleted(new Set((c.data ?? []).map((x) => x.subject_code))); setMissing(m.data ?? []);
  }, [current, studentNo]);
  useEffect(() => { load(); }, [load]);

  const round3 = open?.round === 3;
  const myInOpen = useMemo(() => mine.filter((m) => m.period_id === open?.period_id), [mine, open]);
  const usedRanks = new Set(myInOpen.map((m) => m.preference_rank));

  const apply = async (offeringId: number, subjectName: string) => {
    if (!open) return;
    const row: any = { student_no: studentNo, offering_id: offeringId, period_id: open.period_id };
    if (round3) row.preference_rank = rank[offeringId] ?? [1, 2, 3].find((r) => !usedRanks.has(r));
    const { error } = await supabase.from("applications").insert(row);
    if (error) return flash.fail(`신청 실패: ${errMsg(error)}`);
    flash.ok(`${subjectName} ${round3 ? `${row.preference_rank}지망으로 ` : ""}신청했습니다.`);
    load();
  };
  const cancel = async (applicationId: number) => {
    const { error } = await supabase.from("applications").delete().eq("application_id", applicationId);
    if (error) flash.fail(errMsg(error)); else { flash.ok("신청을 취소했습니다."); load(); }
  };

  return (
    <div className="space-y-5">
      {open ? (
        <Alert kind="info">
          <b>{open.school_year}학년도 {open.semester}학기 {open.round}차 수강신청 기간</b> · {fmtDT(open.starts_at)} ~ {fmtDT(open.ends_at)}
          {round3 && <div className="mt-1">3차는 선착순이 아닙니다. 1~3지망을 입력하면 마감 후 정원 초과 과목은 <b>무작위 추첨</b>하고, 탈락 시 다음 지망으로 배정합니다.</div>}
        </Alert>
      ) : <Alert kind="warn">현재 수강신청 기간이 아닙니다. 개설 현황만 조회할 수 있습니다.</Alert>}
      {missing.length > 0 && (
        <Alert kind="warn">⚠ 필수 이수 과목 <b>{missing.map((m) => m.subject_name).join(", ")}</b>을(를) 아직 신청하지 않았습니다. 졸업 요건을 확인하세요.</Alert>
      )}
      {flash.view}
      <Card title={`개설 과목 현황 (${current?.school_year ?? ""}학년도 ${current?.semester ?? ""}학기)`}
        right={<span className="text-xs text-slate-400">신청 인원·정원·폐강 기준 실시간 공개</span>}>
        <Table head={["과목", "구분", "학점", "신청 / 정원", "폐강 기준", "상태", "내 상태", round3 ? "희망 순위" : "", ""]} empty={!offerings.length}>
          {offerings.map((o) => {
            const my = myInOpen.find((m) => m.offering_id === o.offering_id);
            const assigned = mine.find((m) => m.offering_id === o.offering_id && m.status === "배정완료");
            const isDone = completed.has(o.subject_code);
            const over = o.total_capacity > 0 && o.applicant_count > o.total_capacity;
            return (
              <tr key={o.offering_id} className={o.status === "폐강" ? "bg-slate-50 text-slate-400" : ""}>
                <Td>
                  <div className="font-medium">{o.subject_name}</div>
                  <div className="flex gap-1 text-xs text-slate-400">{o.subject_code}
                    {o.is_required && <Badge tone="폐강">필수</Badge>}{o.is_small_class && <Badge tone="결재중">소인수</Badge>}</div>
                </Td>
                <Td className="text-xs">{o.subject_category}</Td>
                <Td>{o.credits}</Td>
                <Td><span className={over ? "font-semibold text-rose-600" : ""}>{o.applicant_count}</span> / {o.total_capacity}</Td>
                <Td className="text-xs">{o.closing_threshold}명 이하</Td>
                <Td><Badge>{o.status}</Badge></Td>
                <Td>
                  {isDone ? <Badge tone="확인완료">기이수</Badge>
                    : assigned ? <Badge tone="배정완료">배정완료</Badge>
                    : my ? <Badge>{my.preference_rank ? `${my.preference_rank}지망 ${my.status}` : my.status}</Badge> : null}
                </Td>
                <Td>
                  {round3 && !my && !assigned && o.status !== "폐강" && (
                    <select className="rounded border border-slate-300 px-1.5 py-1 text-xs" value={rank[o.offering_id] ?? ""}
                      onChange={(e) => setRank({ ...rank, [o.offering_id]: Number(e.target.value) })}>
                      <option value="">선택</option>
                      {[1, 2, 3].map((r) => <option key={r} value={r} disabled={usedRanks.has(r)}>{r}지망</option>)}
                    </select>
                  )}
                </Td>
                <Td>
                  {my?.status === "신청" ? <Button small variant="secondary" onClick={() => cancel(my.application_id)}>취소</Button>
                    : open && !my && !assigned && o.status !== "폐강" &&
                      <Button small onClick={() => apply(o.offering_id, o.subject_name)}>신청</Button>}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}

function History({ studentNo }: { studentNo: string }) {
  const [apps, setApps] = useState<any[]>([]);
  const [enr, setEnr] = useState<any[]>([]);
  const [cns, setCns] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("applications").select("*, application_periods(round, school_year, semester), offered_courses(subjects(subject_name))")
      .eq("student_no", studentNo).order("applied_at", { ascending: false }).then(({ data }) => setApps(data ?? []));
    supabase.from("enrollments").select("*, sections(section_no, offered_courses(subjects(subject_name)))")
      .eq("student_no", studentNo).then(({ data }) => setEnr(data ?? []));
    supabase.from("counselings").select("*, teachers(users(name))").eq("student_no", studentNo)
      .order("counseled_at", { ascending: false }).then(({ data }) => setCns(data ?? []));
  }, [studentNo]);
  return (
    <div className="space-y-5">
      <Card title="수강 배정 결과">
        <Table head={["과목", "분반", "배정 방식", "상태", "변경 사유"]} empty={!enr.length}>
          {enr.map((e) => (
            <tr key={e.enrollment_id}>
              <Td className="font-medium">{e.sections.offered_courses.subjects.subject_name}</Td>
              <Td>{e.sections.section_no}반</Td><Td>{e.method}</Td><Td><Badge>{e.status}</Badge></Td>
              <Td className="text-xs text-slate-500">{e.change_reason ?? "-"}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="수강신청 내역">
        <Table head={["차수", "과목", "희망 순위", "신청 일시", "상태"]} empty={!apps.length}>
          {apps.map((a) => (
            <tr key={a.application_id}>
              <Td>{a.application_periods.round}차</Td>
              <Td className="font-medium">{a.offered_courses.subjects.subject_name}</Td>
              <Td>{a.preference_rank ? `${a.preference_rank}지망` : "-"}</Td>
              <Td className="text-xs">{fmtDT(a.applied_at)}</Td><Td><Badge>{a.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="상담 기록">
        <Table head={["일시", "구분", "교사", "내용"]} empty={!cns.length}>
          {cns.map((c) => (
            <tr key={c.counseling_id}>
              <Td className="text-xs">{fmtDT(c.counseled_at)}</Td><Td><Badge tone="재신청필요">{c.counsel_type}</Badge></Td>
              <Td>{c.teachers?.users?.name}</Td><Td className="text-xs">{c.content}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

