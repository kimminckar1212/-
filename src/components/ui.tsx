"use client";
import { ReactNode, useState } from "react";

export function Card({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border border-[#d5dbe3] bg-white">
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-[#e3e8ee] bg-[#fafbfc] px-4 py-2.5">
          {title && <h2 className="flex items-center gap-2 text-[14px] font-bold text-[#1b2a3d]"><span className="inline-block h-3.5 w-1 bg-[#1f4e8c]" />{title}</h2>}
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
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
    primary: "bg-[#1f4e8c] text-white border border-[#1f4e8c] hover:bg-[#173d6e]",
    secondary: "bg-white text-[#333] border border-[#b9c2ce] hover:bg-[#f3f5f8]",
    danger: "bg-white text-[#c62828] border border-[#d9a3a3] hover:bg-[#fdf2f2]",
    ghost: "text-[#555] border border-transparent hover:bg-[#eef1f5]",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${v} ${small ? "h-7 px-2.5 text-xs" : "h-9 px-4 text-[13px]"} rounded-[3px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40`}>
      {children}
    </button>
  );
}

const badgeColors: Record<string, string> = {
  신청: "bg-[#e8f0fb] text-[#1f4e8c]", 확인완료: "bg-slate-100 text-slate-700", 재신청필요: "bg-[#fff4e0] text-[#a85b00]",
  폐강: "bg-[#fdecec] text-[#c62828]", 추첨탈락: "bg-[#fdecec] text-[#c62828]", 배정완료: "bg-[#e7f4ec] text-[#1e7a46]",
  개설: "bg-[#e7f4ec] text-[#1e7a46]", 개설예정: "bg-slate-100 text-slate-700",
  작성중: "bg-slate-100 text-slate-700", 결재중: "bg-[#e8f0fb] text-[#1f4e8c]", 반려: "bg-[#fdecec] text-[#c62828]",
  결재완료: "bg-[#e7f4ec] text-[#1e7a46]", 게시: "bg-[#e3eefb] text-[#173d6e]", 취소: "bg-slate-100 text-slate-500",
  검토: "bg-[#fff4e0] text-[#a85b00]", 배정: "bg-[#e8f0fb] text-[#1f4e8c]", 확정: "bg-[#e7f4ec] text-[#1e7a46]",
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const c = badgeColors[tone ?? String(children)] ?? "bg-slate-100 text-slate-700";
  return <span className={`inline-block whitespace-nowrap rounded-[2px] border border-current/20 px-1.5 py-[1px] text-[11px] font-semibold ${c}`}>{children}</span>;
}

export function Alert({ kind = "error", children, onClose }: { kind?: "error" | "success" | "info" | "warn"; children: ReactNode; onClose?: () => void }) {
  if (!children) return null;
  const c = {
    error: "border-rose-200 bg-rose-50 text-rose-800", success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800", warn: "border-amber-200 bg-amber-50 text-amber-900",
  }[kind];
  return (
    <div className={`flex items-start justify-between gap-3 border px-4 py-2.5 text-[13px] ${c}`}>
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
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${value === t ? "border-[#1f4e8c] text-[#173d6e]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children, empty, loading }: { head: ReactNode[]; children: ReactNode; empty?: boolean; loading?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-t-2 border-[#1f4e8c] text-[13px]">
        <thead>
          <tr className="border-b border-[#cfd6df] bg-[#f3f6fa] text-[12px] text-[#3a4756]">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap border-r border-[#e1e6ec] px-3 py-2 text-center font-semibold last:border-r-0">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6eaef] [&_tr:hover]:bg-[#f7f9fc]">{children}</tbody>
      </table>
      {loading ? <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>
        : empty && <p className="py-6 text-center text-sm text-slate-400">데이터가 없습니다</p>}
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) =>
  <td className={`min-w-[3.5rem] border-r border-[#eef1f4] px-3 py-2 text-center align-middle last:border-r-0 ${className}`}>{children}</td>;

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[12px] font-semibold text-[#3a4756]">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = "w-full h-9 rounded-[3px] border border-[#b9c2ce] bg-white px-2.5 text-[13px] focus:border-[#1f4e8c] focus:outline-none focus:ring-1 focus:ring-[#1f4e8c] [textarea&]:h-auto [textarea&]:py-2";

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border border-[#d5dbe3] border-t-2 border-t-[#1f4e8c] bg-white px-4 py-3">
      <div className="text-[12px] font-semibold text-[#5a6878]">{label}</div>
      <div className="mt-1 text-[22px] font-bold text-[#1b2a3d]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export const Loading = ({ text = "불러오는 중…" }: { text?: string }) =>
  <p className="py-10 text-center text-sm text-slate-400">{text}</p>;

export const fmtDT = (s?: string | null) =>
  s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
export const fmtD = (s?: string | null) => (s ? s.slice(0, 10) : "-");
