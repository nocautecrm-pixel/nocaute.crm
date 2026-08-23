"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { META_CONNECTED_LABEL } from "@/lib/whatsapp/constants";
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
  const [account, setAccount] = useState({
    connected: connection.connected,
    displayPhone: connection.displayPhone,
    verifiedName: connection.verifiedName,
    wabaId: connection.wabaId,
    phoneNumberId: connection.phoneNumberId,
    label: connection.label,
  });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
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
      autoLogAppEvents: true,
      xfbml: true,
      version: process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v21.0",
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
      window.FB.login(
        async (response) => {
          try {
            const code = response.authResponse?.code;
            if (!code) throw new Error("Conexão cancelada.");
            await finishSignup(code);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Falha na conexão");
          } finally {
            setBusy(false);
          }
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "",
            sessionInfoVersion: "3",
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na conexão");
      setBusy(false);
    }
  }

  const connected = account.connected;
  const connectDisabled = busy || !officialLoginReady || (officialLoginReady && !sdkReady);
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
    error,
    connected,
    connectDisabled,
    connectLabel,
    officialLoginReady,
    initFacebookSdk,
    connect,
  };
}
