"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { META_CONNECTED_LABEL, META_DISCONNECTED_LABEL } from "@/lib/whatsapp/constants";
import type { WhatsAppConnection } from "@/types/store";

type FbLoginResponse = {
  authResponse?: { code?: string };
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: FbLoginResponse) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type SessionInfo = {
  wabaId?: string;
  phoneNumberId?: string;
};

type SignupResult = {
  ok?: boolean;
  error?: string;
  connected?: boolean;
  displayPhone?: string | null;
  verifiedName?: string | null;
  qualityRating?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  label?: string;
};

function isMetaMessageOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

export function useEmbeddedSignup(
  connection: WhatsAppConnection,
  onConnected?: () => void,
) {
  const session = useRef<SessionInfo>({});
  const sdkInited = useRef(false);
  const [busy, setBusy] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [account, setAccount] = useState({
    connected: connection.connected,
    displayPhone: connection.displayPhone,
    verifiedName: connection.verifiedName,
    wabaId: connection.wabaId,
    phoneNumberId: connection.phoneNumberId,
    label: connection.label,
  });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?.trim();
  const officialLoginReady = Boolean(appId && configId);

  useEffect(() => {
    setAccount({
      connected: connection.connected,
      displayPhone: connection.displayPhone,
      verifiedName: connection.verifiedName,
      wabaId: connection.wabaId,
      phoneNumberId: connection.phoneNumberId,
      label: connection.label,
    });
  }, [connection]);

  const initFacebookSdk = useCallback(() => {
    if (sdkInited.current || !appId || !window.FB) return;
    window.FB.init({
      appId,
      cookie: true,
      autoLogAppEvents: true,
      xfbml: true,
      version: process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v21.0",
      // Chrome FedCM abre login consumer (openid) e ignora config_id do Embedded Signup.
      fedCM: false,
    });
    sdkInited.current = true;
    setSdkReady(true);
  }, [appId]);

  useEffect(() => {
    window.fbAsyncInit = initFacebookSdk;
    initFacebookSdk();

    function onMessage(event: MessageEvent) {
      if (!isMetaMessageOrigin(event.origin)) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "CANCEL") {
          setError("Conexão cancelada.");
          return;
        }
        if (data.event === "ERROR") {
          setError(data.data?.error_message ?? "Erro no Embedded Signup.");
          return;
        }
        // FINISH e FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING (coexistência) trazem os IDs.
        session.current = {
          wabaId: data.data?.waba_id ?? data.data?.wabaId,
          phoneNumberId: data.data?.phone_number_id ?? data.data?.phoneNumberId,
        };
      } catch {
        // ignore non-JSON
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [initFacebookSdk]);

  async function finishSignup(code: string) {
    const response = await fetch("/api/meta/embedded-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        wabaId: session.current.wabaId,
        phoneNumberId: session.current.phoneNumberId,
      }),
    });
    const payload = (await response.json()) as SignupResult;
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível conectar");

    setAccount({
      connected: true,
      displayPhone: payload.displayPhone ?? null,
      verifiedName: payload.verifiedName ?? null,
      wabaId: payload.wabaId ?? session.current.wabaId ?? null,
      phoneNumberId: payload.phoneNumberId ?? session.current.phoneNumberId ?? null,
      label: payload.label ?? META_CONNECTED_LABEL,
    });
    onConnected?.();
  }

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/meta/disconnect", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível desconectar");

      setAccount({
        connected: false,
        displayPhone: null,
        verifiedName: null,
        wabaId: null,
        phoneNumberId: null,
        label: META_DISCONNECTED_LABEL,
      });
      onConnected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      if (!officialLoginReady) {
        throw new Error("WhatsApp oficial da Meta não está configurado neste ambiente.");
      }
      if (!window.FB || !sdkReady) {
        throw new Error("Login da Meta ainda carregando.");
      }

      const loginOptions = {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        fedCM: false,
        extras: {
          setup: {},
          // Coexistência (ligar app do telemóvel). Meta exige Tech Provider + este featureType.
          // Teste: a tela de WABA deve oferecer “conectar WhatsApp Business existente”, não só SMS.
          featureType: "whatsapp_business_app_onboarding",
          feature_type: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      };

      let finished = false;
      const stopBusy = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(stuckTimer);
        setBusy(false);
      };

      const stuckTimer = window.setTimeout(() => {
        stopBusy();
        setError(
          "O login da Meta não abriu. À esquerda da barra do Chrome, permite popups e o início de sessão de terceiros neste site. Depois clica de novo.",
        );
      }, 15000);

      const pending = window.FB.login((response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setError(
            "Popup fechou sem ligar. Se viste SMS ou “já registado”, era o fluxo errado — fecha e procura conectar o app WhatsApp Business (QR), não adicionar número.",
          );
          stopBusy();
          return;
        }
        void finishSignup(code)
          .catch((err) => {
            setError(err instanceof Error ? err.message : "Falha na conexão");
          })
          .finally(() => {
            stopBusy();
          });
      }, loginOptions) as Promise<unknown> | void;

      if (pending && typeof pending.then === "function") {
        pending.catch(() => {
          stopBusy();
          setError(
            "O Chrome bloqueou o login da Meta. Clica no ícone à esquerda do URL, permite início de sessão de terceiros e popups, e tenta de novo.",
          );
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na conexão");
      setBusy(false);
    }
  }

  const connected = account.connected;
  const connectDisabled =
    busy || disconnecting || !officialLoginReady || (officialLoginReady && !sdkReady);
  const disconnectDisabled = busy || disconnecting;
  const connectLabel = busy
    ? "Conectando…"
    : !officialLoginReady
      ? "Meta não configurada"
      : officialLoginReady && !sdkReady
        ? "Carregando Meta…"
        : connected
          ? "Reconectar"
          : "Conectar WhatsApp da loja";

  return {
    account,
    busy,
    disconnecting,
    error,
    connected,
    connectDisabled,
    disconnectDisabled,
    connectLabel,
    officialLoginReady,
    initFacebookSdk,
    connect,
    disconnect,
  };
}
