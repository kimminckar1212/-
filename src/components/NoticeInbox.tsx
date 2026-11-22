"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { Badge, Button, Card, fmtD, fmtDT, inputCls, useFlash } from "./ui";

type Question = { no: number; type: "단일선택" | "복수선택" | "서술형"; question: string; options?: string[] };

/** 학생·학부모 가정통신문함: 열람 기록, 설문 제출·수정 */
export function NoticeInbox({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const [response, setResponse] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<any[]>([]);
  const flash = useFlash();

  const load = useCallback(async () => {
    const { data } = await supabase.from("recipients")
      .select("doc_no, delivered_at, read_at, reminded_at, notices(doc_no, title, body, department, has_survey, survey_questions, reply_deadline, posted_on, delivery_method)")
      .eq("user_id", userId).order("delivered_at", { ascending: false });
    const { data: resp } = await supabase.from("survey_responses").select("doc_no").eq("user_id", userId);
    const answered = new Set((resp ?? []).map((r) => r.doc_no));
    setRows((data ?? []).filter((r: any) => r.notices).map((r: any) => ({ ...r, answered: answered.has(r.doc_no) })));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const openDoc = async (r: any) => {
    flash.clear();
    setOpen(r);
    if (!r.read_at) {
      await supabase.from("recipients").update({ read_at: new Date().toISOString() }).eq("doc_no", r.doc_no).eq("user_id", userId);
      load();
    }
    const { data: resp } = await supabase.from("survey_responses").select("*").eq("doc_no", r.doc_no).eq("user_id", userId).maybeSingle();
    setResponse(resp); setAnswers(resp?.answers ?? {});
    const { data: att } = await supabase.from("attachments").select("*").eq("doc_no", r.doc_no).order("attach_no");
    setAttachments(att ?? []);
  };

  const submit = async () => {
    const q = { doc_no: open.doc_no, user_id: userId, answers };
    const { error } = response
      ? await supabase.from("survey_responses").update({ answers }).eq("response_id", response.response_id)
      : await supabase.from("survey_responses").insert(q);
    if (error) return flash.fail(errMsg(error));
    flash.ok(response ? "응답을 수정했습니다. (최종 제출 시각 갱신)" : "응답을 제출했습니다.");
    const { data: resp } = await supabase.from("survey_responses").select("*").eq("doc_no", open.doc_no).eq("user_id", userId).maybeSingle();
    setResponse(resp); load();
  };

  const n = open?.notices;
  const questions: Question[] = n?.survey_questions ?? [];
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const closed = n?.reply_deadline && today > n.reply_deadline;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Card title={`받은 가정통신문 (${rows.length})`}>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.doc_no}>
                <button onClick={() => openDoc(r)}
                  className={`w-full px-2 py-3 text-left transition hover:bg-slate-50 ${open?.doc_no === r.doc_no ? "bg-teal-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    {!r.read_at && <span className="h-2 w-2 rounded-full bg-rose-500" title="안 읽음" />}
                    <span className="text-xs text-slate-400">{r.doc_no}호</span>
                    {r.notices.has_survey && (r.answered ? <Badge tone="배정완료">응답완료</Badge> : <Badge tone="재신청필요">설문 미응답</Badge>)}
                    {r.reminded_at && !r.answered && <Badge tone="폐강">재안내</Badge>}
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-800">{r.notices.title}</div>
                  <div className="text-xs text-slate-400">{r.notices.department} · 배부 {fmtDT(r.delivered_at)}</div>
                </button>
              </li>
            ))}
            {rows.length === 0 && <li className="py-8 text-center text-sm text-slate-400">받은 가정통신문이 없습니다</li>}
          </ul>
        </Card>
      </div>
      <div className="lg:col-span-3">
        {!open ? (
          <Card><p className="py-16 text-center text-sm text-slate-400">왼쪽에서 가정통신문을 선택하세요</p></Card>
        ) : (
          <Card title={<span>{n.title} <span className="ml-1 text-xs font-normal text-slate-400">{n.doc_no}호</span></span>}>
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{n.department}</span><span>게시일 {fmtD(n.posted_on)}</span><span>전달 {n.delivery_method}</span>
              <span>열람 {fmtDT(open.read_at ?? new Date().toISOString())}</span>
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{n.body}</p>
            {attachments.length > 0 && (
              <div className="mt-3 text-xs text-slate-500">첨부: {attachments.map((a) => a.file_name).join(", ")}</div>
            )}
            {n.has_survey && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">설문 회신</h3>
                  <span className="text-xs text-slate-500">회신기한 {n.reply_deadline}{closed && " (마감)"}</span>
                </div>
                <div className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.no}>
                      <div className="mb-1.5 text-sm text-slate-700">{q.no}. {q.question} <span className="text-xs text-slate-400">({q.type})</span></div>
                      {q.type === "서술형" ? (
                        <textarea className={inputCls} rows={2} value={answers[q.no] ?? ""} disabled={!!closed}
                          onChange={(e) => setAnswers({ ...answers, [q.no]: e.target.value })} />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {q.options?.map((o) => {
                            const multi = q.type === "복수선택";
                            const cur = answers[q.no];
                            const on = multi ? (cur ?? []).includes(o) : cur === o;
                            return (
                              <button key={o} disabled={!!closed}
                                onClick={() => setAnswers({ ...answers, [q.no]: multi ? (on ? cur.filter((x: string) => x !== o) : [...(cur ?? []), o]) : o })}
                                className={`rounded-lg border px-3 py-1.5 text-sm ${on ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-600"}`}>
                                {o}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <Button onClick={submit}>{response ? "응답 수정" : "응답 제출"}</Button>
                  {response && <span className="text-xs text-slate-500">최종 제출 {fmtDT(response.final_submitted_at)}</span>}
                </div>
              </div>
            )}
            {flash.view && <div className="mt-4">{flash.view}</div>}
          </Card>
        )}
      </div>
    </div>
  );
}
