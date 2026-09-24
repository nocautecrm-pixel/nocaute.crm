"use client";

import { useSyncedState } from "@/components/useSyncedState";
import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { META_CONNECTED_LABEL, META_DISCONNECTED_LABEL } from "@/lib/whatsapp/constants";
import type { WhatsAppOnboardingMode } from "@/lib/whatsapp/onboarding-mode";
import { humanizeMetaSignupError, isMetaAppReviewError } from "@/lib/whatsapp/signup-errors";
import type { WhatsAppConnection } from "@/types/store";

const META_STEP_KEY = "nocaute.metaAccount";

type FbAuthResponse = {
  code?: string;
  accessToken?: string;
};

type FbLoginResponse = {
  authResponse?: FbAuthResponse;
  status?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: FbLoginResponse) => void, opts: Record<string, unknown>) => void;
      getLoginStatus: (cb: (response: FbLoginResponse) => void, roundtrip?: boolean) => void;
      api: (
        path: string,
        params: Record<string, unknown>,
        cb: (response: { name?: string; error?: { message?: string } }) => void,
      ) => void;
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

export type MetaPortfolioHint = {
  name: string | null;
  hasWhatsAppNumber: boolean;
  limited: boolean;
  displayPhone: string | null;
};

type StoredMetaStep = {
  linked: boolean;
  name: string | null;
};

function isMetaMessageOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

function readStoredMetaStep(): StoredMetaStep | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(META_STEP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMetaStep;
    if (!parsed?.linked) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredMetaStep(step: StoredMetaStep) {
  try {
    window.sessionStorage.setItem(META_STEP_KEY, JSON.stringify(step));
  } catch {
    // ignore
  }
}

export function useEmbeddedSignup(
  connection: WhatsAppConnection,
  onConnected?: () => void,
) {
  const session = useRef<SessionInfo>({});
  const sdkInited = useRef(false);
  const lastMode = useRef<WhatsAppOnboardingMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaChecking, setMetaChecking] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const autoSessionTried = useRef(false);
  const stored = readStoredMetaStep();
  const [metaLinked, setMetaLinked] = useState(
    Boolean(stored?.linked) || connection.connected,
  );
  const [metaName, setMetaName] = useState<string | null>(stored?.name ?? null);
  const [portfolio, setPortfolio] = useState<MetaPortfolioHint | null>(null);
  const [metaFromBrowser, setMetaFromBrowser] = useState(false);
  const incomingAccount = useMemo(
    () => ({
      connected: connection.connected,
      displayPhone: connection.displayPhone,
      verifiedName: connection.verifiedName,
      wabaId: connection.wabaId,
      phoneNumberId: connection.phoneNumberId,
      label: connection.label,
    }),
    [connection],
  );
  const [account, setAccount] = useSyncedState(incomingAccount);

  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?.trim();
  const officialLoginReady = Boolean(appId && configId);

  const initFacebookSdk = useCallback(() => {
    if (sdkInited.current || !appId || !window.FB) return;
    window.FB.init({
      appId,
      cookie: true,
      autoLogAppEvents: true,
      xfbml: true,
      version: process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v21.0",
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
          const raw =
            data.data?.error_message ??
            data.data?.error_code ??
            data.error_message ??
            data.error_code ??
            "Erro no Embedded Signup.";
          const code = data.data?.error_code ?? data.error_code;
          const combined =
            typeof code === "string" || typeof code === "number"
              ? `${raw} (#${code})`
              : String(raw);
          setError(humanizeMetaSignupError(combined, { path: lastMode.current ?? undefined }));
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
    if (!response.ok) {
      throw new Error(
        humanizeMetaSignupError(payload.error ?? "Não foi possível conectar", {
          path: lastMode.current ?? undefined,
        }),
      );
    }

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

  async function fetchPortfolio(accessToken: string, fallbackName: string | null) {
    try {
      const response = await fetch("/api/meta/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const payload = (await response.json()) as {
        error?: string;
        name?: string | null;
        hasWhatsAppNumber?: boolean;
        limited?: boolean;
        phones?: Array<{ displayPhone?: string | null }>;
      };
      if (!response.ok) {
        setPortfolio({
          name: fallbackName,
          hasWhatsAppNumber: false,
          limited: true,
          displayPhone: null,
        });
        return;
      }
      setPortfolio({
        name: payload.name ?? fallbackName,
        hasWhatsAppNumber: Boolean(payload.hasWhatsAppNumber),
        limited: Boolean(payload.limited),
        displayPhone: payload.phones?.[0]?.displayPhone ?? null,
      });
      if (payload.name) setMetaName(payload.name);
    } catch {
      setPortfolio({
        name: fallbackName,
        hasWhatsAppNumber: false,
        limited: true,
        displayPhone: null,
      });
    }
  }

  function adoptMetaToken(accessToken: string, fromBrowser: boolean) {
    return new Promise<void>((resolve) => {
      window.FB?.api("/me", { fields: "name" }, (me) => {
        const name = me?.name ?? null;
        setMetaLinked(true);
        setMetaName(name);
        setMetaFromBrowser(fromBrowser);
        writeStoredMetaStep({ linked: true, name });
        void fetchPortfolio(accessToken, name).finally(() => resolve());
      });
    });
  }

  /** Usa a sessão Facebook já aberta no navegador, se existir. */
  function tryAdoptBrowserSession(opts?: { silent?: boolean }) {
    return new Promise<boolean>((resolve) => {
      if (!window.FB) {
        resolve(false);
        return;
      }
      window.FB.getLoginStatus((response) => {
        const token = response.authResponse?.accessToken;
        if (response.status === "connected" && token) {
          void adoptMetaToken(token, true).then(() => resolve(true));
          return;
        }
        resolve(false);
      }, true);
    });
  }

  useEffect(() => {
    if (!sdkReady || !officialLoginReady || connection.connected) return;
    if (autoSessionTried.current) return;
    if (metaLinked && portfolio) return;
    autoSessionTried.current = true;
    setMetaChecking(true);
    void tryAdoptBrowserSession({ silent: true }).finally(() => {
      setMetaChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when SDK becomes ready
  }, [sdkReady, officialLoginReady, connection.connected]);

  async function linkMeta() {
    setMetaBusy(true);
    setError(null);
    try {
      if (!officialLoginReady) {
        throw new Error("Meta não está configurada neste ambiente.");
      }
      if (!window.FB || !sdkReady) {
        throw new Error("Login da Meta ainda carregando.");
      }

      const already = await tryAdoptBrowserSession({ silent: true });
      if (already) {
        setMetaBusy(false);
        return;
      }

      let finished = false;
      const stopBusy = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(stuckTimer);
        setMetaBusy(false);
      };

      const stuckTimer = window.setTimeout(() => {
        stopBusy();
        setError(
          "O login da Meta não abriu. Permite popups neste site e tenta de novo.",
        );
      }, 15000);

      const pending = window.FB.login((response) => {
        const token = response.authResponse?.accessToken;
        if (!token) {
          setError("Entre com o Facebook da loja para continuar.");
          stopBusy();
          return;
        }

        void adoptMetaToken(token, false).finally(() => stopBusy());
      }, {
        scope: "public_profile,email,business_management",
        return_scopes: true,
        fedCM: false,
      }) as Promise<unknown> | void;

      if (pending && typeof pending.then === "function") {
        pending.catch(() => {
          stopBusy();
          setError(
            "O Chrome bloqueou o login da Meta. Permite popups e início de sessão de terceiros.",
          );
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar na Meta");
      setMetaBusy(false);
    }
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

  async function connect(mode: WhatsAppOnboardingMode = "existing") {
    setBusy(true);
    setError(null);
    lastMode.current = mode;
    try {
      if (!officialLoginReady) {
        throw new Error("WhatsApp oficial da Meta não está configurado neste ambiente.");
      }
      if (!window.FB || !sdkReady) {
        throw new Error("Login da Meta ainda carregando.");
      }

      const extras =
        mode === "existing"
          ? {
              setup: {},
              featureType: "whatsapp_business_app_onboarding",
              sessionInfoVersion: "3",
            }
          : {
              setup: {},
              sessionInfoVersion: "3",
            };

      const loginOptions = {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        fedCM: false,
        extras,
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
          "A janela da Meta não abriu. Permite popups neste site e tenta de novo.",
        );
      }, 15000);

      const pending = window.FB.login((response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setError(
            humanizeMetaSignupError(
              mode === "existing"
                ? "Janela fechou sem conectar. Entre com o Facebook da loja e escolha ligar o WhatsApp do celular (QR)."
                : "Janela fechou sem conectar. Tente de novo. Se a loja já usa WhatsApp no celular, escolha “Já uso no celular”.",
              { path: mode },
            ),
          );
          stopBusy();
          return;
        }
        void finishSignup(code)
          .catch((err) => {
            setError(
              err instanceof Error
                ? humanizeMetaSignupError(err.message, { path: mode })
                : "Falha na conexão",
            );
          })
          .finally(() => {
            stopBusy();
          });
      }, loginOptions) as Promise<unknown> | void;

      if (pending && typeof pending.then === "function") {
        pending.catch(() => {
          stopBusy();
          setError(
            "O Chrome bloqueou o login da Meta. Permite popups e início de sessão de terceiros.",
          );
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na conexão");
      setBusy(false);
    }
  }

  const connected = account.connected;
  const metaDisabled =
    metaBusy ||
    metaChecking ||
    busy ||
    disconnecting ||
    !officialLoginReady ||
    (officialLoginReady && !sdkReady);
  const connectDisabled =
    busy ||
    disconnecting ||
    metaBusy ||
    metaChecking ||
    (!metaLinked && !connected) ||
    !officialLoginReady ||
    (officialLoginReady && !sdkReady);
  const disconnectDisabled = busy || disconnecting || metaBusy;
  const connectLabel = busy
    ? "Conectando…"
    : !officialLoginReady
      ? "Meta não configurada"
      : officialLoginReady && !sdkReady
        ? "Carregando Meta…"
        : !metaLinked
          ? "Entre na Meta primeiro"
          : connected
            ? "Abrir de novo a Meta"
            : "Conectar WhatsApp da loja";

  const recommendedMode: WhatsAppOnboardingMode =
    portfolio?.hasWhatsAppNumber === false && portfolio.limited === false
      ? "new"
      : "existing";

  return {
    account,
    busy,
    metaBusy,
    metaChecking,
    metaFromBrowser,
    disconnecting,
    error,
    appReviewBlocked: isMetaAppReviewError(error),
    connected,
    metaLinked,
    metaName,
    portfolio,
    recommendedMode,
    connectDisabled,
    metaDisabled,
    disconnectDisabled,
    connectLabel,
    officialLoginReady,
    initFacebookSdk,
    linkMeta,
    connect,
    disconnect,
  };
}
