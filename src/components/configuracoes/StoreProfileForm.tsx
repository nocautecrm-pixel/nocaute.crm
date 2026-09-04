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

const STEPS = [
  {
    title: "Quem é a loja",
    hint: "Logo, nome e cidade. Isso aparece no painel e nas campanhas.",
  },
  {
    title: "Como o cliente chega",
    hint: "Cardápio e endereço. O botão da oferta aponta para este link.",
  },
  {
    title: "Quando abre",
    hint: "Horário em texto, como o cliente vê na porta.",
  },
] as const;

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
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState(name);
  const [storeCity, setStoreCity] = useState(city);
  const [menu, setMenu] = useState(menuUrl);
  const [addr, setAddr] = useState(address);
  const [hours, setHours] = useState(hoursText);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const lastStep = STEPS.length - 1;
  const current = STEPS[step];

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

  function goNext() {
    setStatus(null);
    if (step === 0 && storeName.trim().length < 2) {
      setStatus("Informe o nome da loja para continuar.");
      return;
    }
    setStep((value) => Math.min(lastStep, value + 1));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step < lastStep) {
      goNext();
      return;
    }

    if (storeName.trim().length < 2) {
      setStep(0);
      setStatus("Informe o nome da loja para salvar.");
      return;
    }

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
      <div className="shrink-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#667781]">
          Etapa {step + 1} de {STEPS.length}
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">{current.title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{current.hint}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {step === 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <StoreLogo name={storeName} url={logo} size="md" />
                <label>
                  <span
                    className={`${btnSecondaryClass} cursor-pointer ${uploadingLogo ? "opacity-50" : ""}`}
                  >
                    {uploadingLogo ? "Enviando…" : logo ? "Trocar logo" : "Enviar logo"}
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
                  placeholder="Digite o nome do seu restaurante"
                  className={inputClass}
                  required
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Cidade</span>
                <input
                  value={storeCity}
                  onChange={(event) => setStoreCity(event.target.value)}
                  placeholder="Digite a cidade do seu restaurante"
                  className={inputClass}
                />
              </label>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <label className={labelClass}>
                <span className={labelTextClass}>Link do cardápio</span>
                <input
                  value={menu}
                  onChange={(event) => setMenu(event.target.value)}
                  placeholder="Cole o link do cardápio"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Endereço</span>
                <input
                  value={addr}
                  onChange={(event) => setAddr(event.target.value)}
                  placeholder="Digite o endereço da loja"
                  className={inputClass}
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <label className={labelClass}>
              <span className={labelTextClass}>Horário</span>
              <input
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                placeholder="Ex.: Seg–Sáb 11h–15h"
                className={inputClass}
              />
            </label>
          ) : null}
        </div>

        <div className="mt-3 shrink-0 border-t border-[#E9EDEF] pt-3">
          <div className="mb-3 flex items-center justify-center gap-1.5">
            {STEPS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Ir para ${item.title}`}
                onClick={() => {
                  setStatus(null);
                  setStep(index);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  index === step
                    ? "w-6 bg-emerald-600"
                    : index < step
                      ? "w-1.5 bg-emerald-300"
                      : "w-1.5 bg-[#E9EDEF]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                className={btnSecondaryClass}
                onClick={() => {
                  setStatus(null);
                  setStep((value) => Math.max(0, value - 1));
                }}
              >
                Voltar
              </button>
            ) : null}
            <button type="submit" disabled={saving} className={`min-w-0 flex-1 ${btnPrimaryClass}`}>
              {saving ? "Salvando…" : step < lastStep ? "Continuar" : "Salvar loja"}
            </button>
          </div>
          {status ? <p className="mt-2 text-sm text-slate-500">{status}</p> : null}
        </div>
      </form>
    </section>
  );
}
