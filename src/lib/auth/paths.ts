const INTERNAL_PREFIX = "/";

export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;
  if (!value.startsWith(INTERNAL_PREFIX)) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function isPasswordRecoveryPath(path: string) {
  return path === "/redefinir-senha";
}
