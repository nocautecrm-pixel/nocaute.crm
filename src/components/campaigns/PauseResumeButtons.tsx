"use client";

import { useState } from "react";

export function PauseResumeButtons({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const path = current === "paused" ? "resume" : "pause";
    const response = await fetch(`/api/campaigns/${campaignId}/${path}`, {
      method: "POST",
    });
    const payload = (await response.json()) as { status?: string };
    if (payload.status) setCurrent(payload.status);
    setBusy(false);
  }

  if (!["running", "queued", "paused"].includes(current)) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold tracking-tight text-slate-700 transition-all duration-200 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50"
    >
      {current === "paused" ? "Retomar" : "Pausar"}
    </button>
  );
}
