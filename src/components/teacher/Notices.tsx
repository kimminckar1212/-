"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { Badge, Button, Card, Field, fmtD, fmtDT, inputCls, Stat, Table, Td, useFlash } from "../ui";
import { useTeachers } from "./common";

const emptyForm = {
  title: "", body: "", target: "학부모", target_grade: "", reviewer_teacher_no: "", delivery_method: "e알리미·홈페이지",
  has_survey: false, questions: "단일선택|참석 여부|참석,불참", reply_deadline: "",
};

// "유형|질문|보기1,보기2" 한 줄에 한 문항
const parseQuestions = (txt: string) => txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => {
  const [type, question, opts] = l.split("|");
  return { no: i + 1, type: type?.trim(), question: question?.trim(), ...(opts ? { options: opts.split(",").map((o) => o.trim()) } : {}) };
});
const toText = (qs: any[] | null) => (qs ?? []).map((q) => [q.type, q.question, q.options?.join(",")].filter(Boolean).join("|")).join("\n");

/** 가정통신문 기안 → 상신 → (반려 시 수정·재상신) → 게시 → 응답 현황·재안내 */
export function Notices({ teacherNo, department, isJunior }: { teacherNo: string; department: string; isJunior: boolean }) {
  const { list: teachers, name } = useTeachers();
  const [notices, setNotices] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [approver, setApprover] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<string | null>(null);
  const flash = useFlash();

  // 작성 중 내용 임시 보존: 탭 이동·새로고침 후에도 복원
  const draftKey = `notice-draft-${teacherNo}`;
  const dirty = showForm && !!(form.title || form.body || editing);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const d = JSON.parse(saved);
        setForm({ ...emptyForm, ...d.form }); setEditing(d.editing ?? null); setShowForm(true);
        flash.info("저장하지 않은 작성 내용을 불러왔습니다. 저장하거나 닫기를 눌러 정리하세요.");
      }
    } catch { /* 저장소 사용 불가 시 무시 */ }
  }, [draftKey, flash]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (dirty) sessionStorage.setItem(draftKey, JSON.stringify({ form, editing }));
      else sessionStorage.removeItem(draftKey);
    } catch { /* 무시 */ }
  }, [dirty, form, editing, draftKey]);
  useEffect(() => {
    // 창 닫기·새로고침 시 경고
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const closeForm = () => {
    if (dirty && !window.confirm("작성 중인 내용이 저장되지 않았습니다. 버리고 닫을까요?")) return;
    setForm(emptyForm); setEditing(null); setShowForm(false);
  };

  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("notices").select("*").order("created_at", { ascending: false });
    setNotices(data ?? []);
    const { data: a } = await supabase.from("approvals").select("*").order("submit_round").order("step");
    setApprovals(a ?? []);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const payload: any = {
      title: form.title, body: form.body, target: form.target, target_grade: form.target_grade ? Number(form.target_grade) : null,
      reviewer_teacher_no: form.reviewer_teacher_no, delivery_method: form.delivery_method, department,
      has_survey: form.has_survey, survey_questions: form.has_survey ? parseQuestions(form.questions) : null,
      reply_deadline: form.reply_deadline || null,
    };
    let error;
    if (editing) ({ error } = await supabase.from("notices").update(payload).eq("doc_no", editing));
    else {
      const year = new Date().getFullYear();
      const { data: ex } = await supabase.from("notices").select("doc_no").like("doc_no", `${year}-%`);
      const next = Math.max(0, ...(ex ?? []).map((x) => Number(x.doc_no.split("-")[1]))) + 1;
      ({ error } = await supabase.from("notices").insert({ ...payload, doc_no: `${year}-${next}`, writer_teacher_no: teacherNo }));
    }
    if (error) return flash.fail(errMsg(error));
    flash.ok(editing ? "수정했습니다. 재상신할 수 있습니다." : "작성중 문서로 저장했습니다. 1차 결재자를 지정해 상신하세요.");
    setForm(emptyForm); setEditing(null); setShowForm(false); load();
  };

  const edit = (n: any) => {
    setForm({ ...emptyForm, ...n, target_grade: n.target_grade ?? "", reply_deadline: n.reply_deadline ?? "", questions: toText(n.survey_questions) || emptyForm.questions });
    setEditing(n.doc_no); setShowForm(true); flash.clear();
  };

  const submit = async (n: any) => {
    const rounds = approvals.filter((a) => a.doc_no === n.doc_no).map((a) => a.submit_round);
    const round = rounds.length ? Math.max(...rounds) + 1 : 1;
    const { error } = await supabase.from("approvals").insert({
      teacher_no: approver[n.doc_no], doc_no: n.doc_no, submit_round: round, step: "1차", status: "검토",
    });
    if (error) return flash.fail(errMsg(error));
    flash.ok(`${round > 1 ? `${round}차 재상신` : "상신"}했습니다. 1차 결재자: ${name(approver[n.doc_no])}`); load();
  };

  const publish = async (n: any) => {
    const { data, error } = await supabase.rpc("publish_notice", { p_doc_no: n.doc_no });
    if (error) return flash.fail(errMsg(error));
    flash.ok(`게시했습니다. 수신 대상 ${data}명에게 배부 기록을 생성했습니다.`); load();
  };

  const juniors = teachers.filter((t) => t.isJunior && t.teacher_no !== teacherNo);
  const seniors = teachers.filter((t) => t.isSenior);

  return (
    <div className="space-y-5">
      {flash.view}
      {isJunior ? (
        !showForm && <div><Button onClick={() => { setForm({ ...emptyForm, reviewer_teacher_no: seniors[0]?.teacher_no ?? "" }); setEditing(null); setShowForm(true); flash.clear(); }}>+ 새 가정통신문 기안</Button></div>
      ) : (
        <p className="text-xs text-slate-500">부장교사(선임)는 기안하지 않고 결재함에서 최종 결재합니다. 아래는 전체 문서 현황입니다.</p>
      )}

      {showForm && (
        <Card title={editing ? `${editing}호 수정 (반려 사유 반영)` : "가정통신문 기안"} right={<Button small variant="ghost" onClick={closeForm}>닫기</Button>}>
          {editing && (() => {
            const rej = approvals.filter((a) => a.doc_no === editing && a.status === "반려").pop();
            return rej ? <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">반려 사유 ({name(rej.teacher_no)}): {rej.reject_reason}</div> : null;
          })()}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="제목"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="대상">
                <select className={inputCls} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
                  <option>학생</option><option>학부모</option><option>학생·학부모</option>
                </select>
              </Field>
              <Field label="대상 학년">
                <select className={inputCls} value={form.target_grade} onChange={(e) => setForm({ ...form, target_grade: e.target.value })}>
                  <option value="">전 학년</option><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option>
                </select>
              </Field>
            </div>
          </div>
          <div className="mt-4"><Field label="본문"><textarea className={inputCls} rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="최종 검토 부장교사">
              <select className={inputCls} value={form.reviewer_teacher_no} onChange={(e) => setForm({ ...form, reviewer_teacher_no: e.target.value })}>
                {seniors.map((t) => <option key={t.teacher_no} value={t.teacher_no}>{t.name} ({t.department})</option>)}
              </select>
            </Field>
            <Field label="전달 방식">
              <select className={inputCls} value={form.delivery_method} onChange={(e) => setForm({ ...form, delivery_method: e.target.value })}>
                <option>e알리미·홈페이지</option><option>e알리미</option><option>홈페이지</option>
              </select>
            </Field>
            <Field label="설문 포함">
              <select className={inputCls} value={form.has_survey ? "1" : "0"} onChange={(e) => setForm({ ...form, has_survey: e.target.value === "1" })}>
                <option value="0">없음</option><option value="1">있음</option>
              </select>
            </Field>
          </div>
          {form.has_survey && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2"><Field label="설문 문항 (한 줄에 한 문항: 유형|질문|보기1,보기2 — 유형은 단일선택·복수선택·서술형)">
                <textarea className={`${inputCls} font-mono text-xs`} rows={4} value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} />
              </Field></div>
              <Field label="회신 기한"><input type="date" className={inputCls} value={form.reply_deadline} onChange={(e) => setForm({ ...form, reply_deadline: e.target.value })} /></Field>
            </div>
          )}
          <div className="mt-4"><Button onClick={save} disabled={!form.title || !form.body || !form.reviewer_teacher_no}>{editing ? "수정 저장" : "작성중으로 저장"}</Button></div>
        </Card>
      )}

      <Card title="가정통신문 목록">
        <Table head={["문서번호", "제목", "작성", "최종 검토", "대상", "상태", "진행"]} loading={!loaded} empty={!notices.length}>
          {notices.map((n) => {
            const mine = n.writer_teacher_no === teacherNo;
            const hist = approvals.filter((a) => a.doc_no === n.doc_no);
            return (
              <tr key={n.doc_no} className="align-top">
                <Td className="text-xs">{n.doc_no}호</Td>
                <Td><button className="text-left font-medium hover:underline" onClick={() => setDetail(detail === n.doc_no ? null : n.doc_no)}>{n.title}</button>
                  {hist.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {hist.map((a) => (
                        <div key={a.teacher_no + a.submit_round} className="text-[11px] text-slate-500">
                          상신 {a.submit_round}회차 · {a.step} 결재 {name(a.teacher_no)} <Badge>{a.status}</Badge>{a.reject_reason && <span className="text-rose-600"> “{a.reject_reason}”</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </Td>
                <Td>{name(n.writer_teacher_no)}</Td><Td>{name(n.reviewer_teacher_no)}</Td>
                <Td className="text-xs">{n.target}{n.target_grade ? ` ${n.target_grade}학년` : ""}{n.has_survey && " · 설문"}</Td>
                <Td><Badge>{n.status}</Badge></Td>
                <Td>
                  {mine && (n.status === "작성중" || n.status === "반려") && (
                    <div className="flex flex-col gap-1.5">
                      <Button small variant="secondary" onClick={() => edit(n)}>수정</Button>
                      <div className="flex gap-1">
                        <select className="rounded border border-slate-300 px-1 text-xs" value={approver[n.doc_no] ?? ""} onChange={(e) => setApprover({ ...approver, [n.doc_no]: e.target.value })}>
                          <option value="">1차 결재자</option>
                          {juniors.map((t) => <option key={t.teacher_no} value={t.teacher_no}>{t.name}</option>)}
                        </select>
                        <Button small disabled={!approver[n.doc_no]} onClick={() => submit(n)}>{n.status === "반려" ? "재상신" : "상신"}</Button>
                      </div>
                    </div>
                  )}
                  {mine && n.status === "결재완료" && <Button small onClick={() => publish(n)}>게시·배부</Button>}
                  {n.status === "게시" && <Button small variant="secondary" onClick={() => setDetail(detail === n.doc_no ? null : n.doc_no)}>응답 현황</Button>}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {detail && <NoticeDetail key={detail} docNo={detail} onFlash={flash} />}
    </div>
  );
}

function NoticeDetail({ docNo, onFlash }: { docNo: string; onFlash: ReturnType<typeof useFlash> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [n, setN] = useState<any>(null);
  const [stat, setStat] = useState<any>(null);
  const [non, setNon] = useState<any[]>([]);
  const [resp, setResp] = useState<any[]>([]);
  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from("notices").select("*").eq("doc_no", docNo).single(),
      supabase.from("v_notice_stats").select("*").eq("doc_no", docNo).single(),
      supabase.from("v_nonresponders").select("*").eq("doc_no", docNo),
      supabase.from("survey_responses").select("answers").eq("doc_no", docNo),
    ]);
    setN(a.data); setStat(b.data); setNon(c.data ?? []); setResp(d.data ?? []);
  }, [docNo]);
  useEffect(() => { load(); }, [load]);
  const remind = async () => {
    const { data, error } = await supabase.rpc("remind_nonresponders", { p_doc_no: docNo });
    if (error) return onFlash.fail(errMsg(error));
    onFlash.ok(`미응답자 ${data}명에게 재안내를 기록했습니다.`); load();
  };
  useEffect(() => {
    if (n) boxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [n]);
  if (!n) return <div ref={boxRef}><Card><p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p></Card></div>;
  const qs: any[] = n.survey_questions ?? [];
  return (
    <div ref={boxRef} className="scroll-mt-4">
    <Card title={`${n.doc_no}호 ${n.title}`} right={<span className="text-xs text-slate-400">응답 현황 상세</span>}>
      <p className="mb-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{n.body}</p>
      {stat && n.status === "게시" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="수신 대상" value={`${stat.recipient_count}명`} sub={`게시 ${fmtD(n.posted_on)}`} />
            <Stat label="열람" value={`${stat.read_count}명`} sub={`열람률 ${stat.recipient_count ? Math.round((100 * stat.read_count) / stat.recipient_count) : 0}%`} />
            {n.has_survey && <Stat label="응답" value={`${stat.response_count}명`} sub={`응답률 ${stat.response_rate}%`} />}
            {n.has_survey && <Stat label="회신 기한" value={n.reply_deadline} />}
          </div>
          {n.has_survey && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">문항별 집계</h3>
                {qs.filter((q) => q.options).map((q) => (
                  <div key={q.no} className="mb-3">
                    <div className="mb-1 text-xs text-slate-600">{q.no}. {q.question}</div>
                    {q.options.map((o: string) => {
                      const c = resp.filter((r) => { const v = r.answers?.[q.no]; return Array.isArray(v) ? v.includes(o) : v === o; }).length;
                      const pct = resp.length ? (100 * c) / resp.length : 0;
                      return (
                        <div key={o} className="mb-1 flex items-center gap-2 text-xs">
                          <span className="w-20 shrink-0 text-slate-600">{o}</span>
                          <div className="h-3 flex-1 rounded bg-slate-100"><div className="h-3 rounded bg-teal-600" style={{ width: `${pct}%` }} /></div>
                          <span className="w-8 text-right text-slate-500">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">미응답자 ({non.length})</h3>
                  <Button small onClick={remind} disabled={!non.length}>미응답자 재안내</Button>
                </div>
                <Table head={["이름", "소속 · 관계", "열람", "재안내"]} empty={!non.length}>
                  {non.map((r) => (
                    <tr key={r.user_id}>
                      <Td><div className="font-medium">{r.name}</div><div className="text-[11px] text-slate-400">{r.user_type}</div></Td>
                      <Td className="text-xs">{r.affiliation ?? "-"}</Td>
                      <Td className="text-xs">{r.read_at ? fmtDT(r.read_at) : <span className="text-rose-500">미열람</span>}</Td>
                      <Td className="text-xs">{fmtDT(r.reminded_at)}</Td></tr>
                  ))}
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
    </div>
  );
}
