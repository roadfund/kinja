"use client";

import { useState } from "react";

// Sends JSON to an API route and tracks loading and error state for a form.
export function useJsonAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<T | null> {
    setPending(true);
    setError("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
      return data as T;
    } catch (actionError) {
      setError(actionError instanceof Error && actionError.message !== "Failed to fetch" ? actionError.message : "Could not reach the server. Check your connection and try again.");
      return null;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error, setError };
}
