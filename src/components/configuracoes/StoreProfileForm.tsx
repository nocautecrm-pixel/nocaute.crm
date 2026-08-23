"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreLogo } from "@/components/dashboard/StoreLogo";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
  labelTextClass,
} from "@/components/ui/tokens";

export function StoreProfileForm({
  name,
  city,
  logoUrl,
  menuUrl = "",
  address = "",
  hoursText = "",
}: {
  name: string;
  city: string;
  logoUrl: string | null;
  menuUrl?: string;
  address?: string;
  hoursText?: string;
}) {
  const router = useRouter();
  const [storeName, setStoreName] = useState(name);
  const [storeCity, setStoreCity] = useState(city);
  const [menu, setMenu] = useState(menuUrl);
  const [addr, setAddr] = useState(address);
  const [hours, setHours] = useState(hoursText);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setLogo(logoUrl);
  }, [logoUrl]);

  useEffect(() => {
    setStoreName(name);
    setStoreCity(city);
    setMenu(menuUrl);
    setAddr(address);
    setHours(hoursText);
  }, [name, city, menuUrl, address, hoursText]);

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/store/logo", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Não foi possível enviar o logo");
      }
      setLogo(payload.url);
      setStatus("Logo atualizado.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao enviar o logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/store/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName,
          city: storeCity,
          menuUrl: menu,
          address: addr,
          hoursText: hours,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar");
      setStatus("Dados da loja atualizados.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${cardClass} flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4`}>
      <h2 className="shrink-0 text-base font-semibold tracking-tight text-slate-900">Identidade</h2>
      <p className="mt-0.5 shrink-0 text-sm text-slate-500">Nome, cidade e logo da loja.</p>

      <form onSubmit={onSubmit} className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <StoreLogo name={storeName} url={logo} size="md" />
          <label>
            <span className={`${btnSecondaryClass} cursor-pointer ${uploadingLogo ? "opacity-50" : ""}`}>
              {uploadingLogo ? "Enviando…" : "Trocar logo"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploadingLogo}
              onChange={(event) => onLogo(event.target.files?.[0])}
            />
          </label>
        </div>

        <label className={labelClass}>
          <span className={labelTextClass}>Nome da loja</span>
          <input
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            className={inputClass}
            required
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Cidade</span>
          <input
            value={storeCity}
            onChange={(event) => setStoreCity(event.target.value)}
            placeholder="Ex.: São Paulo"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Link do cardápio</span>
          <input
            value={menu}
            onChange={(event) => setMenu(event.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Endereço</span>
          <input
            value={addr}
            onChange={(event) => setAddr(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Horário (texto)</span>
          <input
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            placeholder="Seg–Sáb 11h–15h"
            className={inputClass}
          />
        </label>

        <button type="submit" disabled={saving} className={`mt-auto ${btnPrimaryClass}`}>
          {saving ? "Salvando…" : "Salvar loja"}
        </button>
        {status ? <p className="text-sm text-slate-500">{status}</p> : null}
      </form>
    </section>
  );
}
