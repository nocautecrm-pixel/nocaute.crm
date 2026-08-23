export function StatusDot({
  tone = "idle",
}: {
  tone?: "live" | "pending" | "offline" | "idle";
}) {
  const fill = {
    live: "bg-emerald-500",
    pending: "bg-amber-500",
    offline: "bg-red-500",
    idle: "bg-slate-300",
  }[tone];

  const ping = {
    live: "bg-emerald-400",
    pending: "bg-amber-400",
    offline: "bg-red-400",
    idle: "",
  }[tone];

  return (
    <span className="relative inline-flex h-1.5 w-1.5">
      {ping ? (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${ping} opacity-50`}
        />
      ) : null}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${fill}`} />
    </span>
  );
}
