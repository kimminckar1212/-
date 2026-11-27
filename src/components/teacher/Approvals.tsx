"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { Badge, Button, Card, fmtDT, inputCls, Table, Td, useFlash } from "../ui";
import { useTeachers } from "./common";

/** 결재함: 1차(일반교사) → 최종(부장교사), 반려 시 사유 필수 */
export function Approvals({ teacherNo }: { teacherNo: string }) {
  const { name } = useTeachers();
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const flash = useFlash();

  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const { data: p } = await supabase.from("approvals").select("*, notices(*)").eq("teacher_no", teacherNo).eq("status", "검토");
    setPending(p ?? []);
    const { data: h } = await supabase.from("approvals").select("*, notices(title)").eq("teacher_no", teacherNo).neq("status", "검토")
      .order("decided_at", { ascending: false });
    setHistory(h ?? []);
    setLoaded(true);
  }, [teacherNo]);
  useEffect(() => { load(); }, [load]);

  const key = (a: any) => `${a.doc_no}-${a.submit_round}`;
  const approve = async (a: any) => {
    const { error } = await supabase.from("approvals").update({ status: "결재완료" })
      .eq("teacher_no", teacherNo).eq("doc_no", a.doc_no).eq("submit_round", a.submit_round);
    if (error) return flash.fail(errMsg(error));
    if (a.step === "1차") {
      // 1차 승인 → 지정 부장교사에게 최종 결재 요청
      const { error: e2 } = await supabase.from("approvals").insert({
        teacher_no: a.notices.reviewer_teacher_no, doc_no: a.doc_no, submit_round: a.submit_round, step: "최종", status: "검토",
      });
      if (e2) return flash.fail(errMsg(e2));
      flash.ok(`1차 결재 완료. 최종 결재자 ${name(a.notices.reviewer_teacher_no)}에게 넘어갔습니다.`);
    } else flash.ok("최종 결재 완료. 기안자가 게시할 수 있습니다.");
    load();
  };
  const reject = async (a: any) => {
    const { error } = await supabase.from("approvals").update({ status: "반려", reject_reason: reason[key(a)] ?? "" })
      .eq("teacher_no", teacherNo).eq("doc_no", a.doc_no).eq("submit_round", a.submit_round);
    if (error) return flash.fail(errMsg(error));
    flash.ok("반려했습니다. 기안자가 수정 후 재상신하면 다음 차수로 이력이 남습니다."); load();
  };

  return (
    <div className="space-y-5">
      {flash.view}
      <Card title={`결재 대기 (${pending.length})`}>
        {!loaded && <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>}
        {loaded && pending.length === 0 && <p className="py-6 text-center text-sm text-slate-400">결재할 문서가 없습니다</p>}
        <div className="space-y-4">
          {pending.map((a) => (
            <div key={key(a)} className="rounded-[3px] border border-slate-200 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="검토">{a.step} 결재</Badge>
                <span className="text-xs text-slate-500">{a.doc_no}호 · {a.submit_round}차 상신 · 기안 {name(a.notices.writer_teacher_no)} · {a.notices.department}</span>
              </div>
              <div className="font-medium text-slate-800">{a.notices.title}</div>
              <p className="mt-2 whitespace-pre-wrap rounded-[3px] bg-slate-50 p-3 text-sm text-slate-700">{a.notices.body}</p>
              <div className="mt-1 text-xs text-slate-500">
                대상 {a.notices.target}{a.notices.target_grade ? ` ${a.notices.target_grade}학년` : ""} · {a.notices.delivery_method}
                {a.notices.has_survey && ` · 설문 ${a.notices.survey_questions?.length ?? 0}문항 (기한 ${a.notices.reply_deadline})`}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={() => approve(a)}>승인</Button>
                <input className={`${inputCls} max-w-md`} placeholder="반려 사유 (반려 시 필수)" value={reason[key(a)] ?? ""}
                  onChange={(e) => setReason({ ...reason, [key(a)]: e.target.value })} />
                <Button variant="danger" onClick={() => reject(a)}>반려</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="나의 결재 이력">
        <Table head={["결재일시", "문서", "차수", "단계", "결과", "반려 사유"]} loading={!loaded} empty={!history.length}>
          {history.map((h) => (
            <tr key={key(h)}>
              <Td className="text-xs">{fmtDT(h.decided_at)}</Td><Td className="font-medium">{h.doc_no}호 {h.notices?.title}</Td>
              <Td>{h.submit_round}차</Td><Td>{h.step}</Td><Td><Badge>{h.status}</Badge></Td>
              <Td className="text-xs text-rose-600">{h.reject_reason ?? ""}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
