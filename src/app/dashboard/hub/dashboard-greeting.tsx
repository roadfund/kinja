"use client";

import { useEffect, useState } from "react";
import { firstName } from "@/domain/person";

function getGreeting(hour: number): string {
  if (hour < 5) return "Hello";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Hello";
}

export function DashboardGreeting({ fullName }: { fullName: string }) {
  const name = firstName(fullName);
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    const timer = window.setTimeout(() => setGreeting(getGreeting(new Date().getHours())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--kinja-green)] sm:text-4xl">{name ? `${greeting}, ${name}.` : `${greeting}.`}</h1><p className="mt-3 text-[#5d685e]">Here&apos;s what&apos;s happening today.</p></>;
}