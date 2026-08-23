"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#8696A0] transition-colors hover:bg-[#2A3942] hover:text-[#E9EDEF]"
    >
      <LogOut className="h-4 w-4" strokeWidth={1.75} />
      Sair
    </button>
  );
}
