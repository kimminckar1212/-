"use client";
import { ReactNode } from "react";

export const DAYS = ["월", "화", "수", "목", "금"] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export type Slot = { day_of_week: string; period: number; title: string; sub?: string; extra?: ReactNode };

const palette = ["bg-teal-50 border-teal-200", "bg-sky-50 border-sky-200", "bg-amber-50 border-amber-200", "bg-violet-50 border-violet-200",
  "bg-rose-50 border-rose-200", "bg-emerald-50 border-emerald-200", "bg-orange-50 border-orange-200", "bg-indigo-50 border-indigo-200"];

export function TimetableGrid({ slots }: { slots: Slot[] }) {
  const titles = [...new Set(slots.map((s) => s.title))];
  const color = (t: string) => palette[titles.indexOf(t) % palette.length];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-14 border border-slate-200 bg-slate-50 py-2 text-slate-500">교시</th>
            {DAYS.map((d) => <th key={d} className="border border-slate-200 bg-slate-50 py-2 text-slate-600">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <tr key={p}>
              <td className="border border-slate-200 bg-slate-50 text-center text-slate-500">{p}</td>
              {DAYS.map((d) => {
                const cell = slots.filter((s) => s.day_of_week === d && s.period === p);
                return (
                  <td key={d} className="h-14 border border-slate-200 p-1 align-top">
                    {cell.map((s, i) => (
                      <div key={i} className={`mb-1 rounded-md border px-1.5 py-1 ${color(s.title)}`}>
                        <div className="font-medium text-slate-800">{s.title}</div>
                        {s.sub && <div className="text-[11px] text-slate-500">{s.sub}</div>}
                        {s.extra}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
