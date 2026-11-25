"use client";
import { ReactNode, useState } from "react";

export function Card({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({
  children, onClick, variant = "primary", disabled, type = "button", small,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean; type?: "button" | "submit"; small?: boolean;
}) {
  const v = {
    primary: "bg-teal-700 text-white hover:bg-teal-800",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${v} ${small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"} rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40`}>
      {children}
    </button>
  );
}

const badgeColors: Record<string, string> = {
  신청: "bg-sky-100 text-sky-800", 확인완료: "bg-slate-100 text-slate-700", 재신청필요: "bg-amber-100 text-amber-800",
  폐강: "bg-rose-100 text-rose-800", 추첨탈락: "bg-rose-100 text-rose-800", 배정완료: "bg-emerald-100 text-emerald-800",
  개설: "bg-emerald-100 text-emerald-800", 개설예정: "bg-slate-100 text-slate-700",
  작성중: "bg-slate-100 text-slate-700", 결재중: "bg-sky-100 text-sky-800", 반려: "bg-rose-100 text-rose-800",
  결재완료: "bg-emerald-100 text-emerald-800", 게시: "bg-teal-100 text-teal-800", 취소: "bg-slate-100 text-slate-500",
  검토: "bg-amber-100 text-amber-800", 배정: "bg-sky-100 text-sky-800", 확정: "bg-emerald-100 text-emerald-800",
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const c = badgeColors[tone ?? String(children)] ?? "bg-slate-100 text-slate-700";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

export function Alert({ kind = "error", children, onClose }: { kind?: "error" | "success" | "info" | "warn"; children: ReactNode; onClose?: () => void }) {
  if (!children) return null;
  const c = {
    error: "border-rose-200 bg-rose-50 text-rose-800", success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800", warn: "border-amber-200 bg-amber-50 text-amber-900",
  }[kind];
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${c}`}>
      <div>{children}</div>
      {onClose && <button onClick={onClose} className="opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

/** 처리 결과 메시지 상태 */
export function useFlash() {
  const [flash, setFlash] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const view = flash ? <Alert kind={flash.kind} onClose={() => setFlash(null)}>{flash.text}</Alert> : null;
  return {
    view,
    ok: (text: string) => setFlash({ kind: "success", text }),
    fail: (text: string) => setFlash({ kind: "error", text }),
    info: (text: string) => setFlash({ kind: "info", text }),
    clear: () => setFlash(null),
  };
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[] | T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${value === t ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children, empty, loading }: { head: ReactNode[]; children: ReactNode; empty?: boolean; loading?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {loading ? <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>
        : empty && <p className="py-6 text-center text-sm text-slate-400">데이터가 없습니다</p>}
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) =>
  <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export const Loading = ({ text = "불러오는 중…" }: { text?: string }) =>
  <p className="py-10 text-center text-sm text-slate-400">{text}</p>;

export const fmtDT = (s?: string | null) =>
  s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
export const fmtD = (s?: string | null) => (s ? s.slice(0, 10) : "-");
