"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeOf, loadProfile } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    loadProfile().then((p) => router.replace(p ? homeOf(p.role) : "/login"));
  }, [router]);
  return <p className="py-20 text-center text-sm text-slate-400">이동 중…</p>;
}
