"use client";

export function StoreLogo({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const box =
    size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`${box} rounded-full object-cover ring-1 ring-slate-200/80`}
      />
    );
  }

  return (
    <div
      className={`${box} flex items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50 font-bold text-emerald-700`}
    >
      {initial}
    </div>
  );
}
