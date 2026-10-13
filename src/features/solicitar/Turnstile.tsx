import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

export interface TurnstileHandle {
  reset: () => void;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", reject);
    if (!existing) {
      s.src = SCRIPT;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

/** Verificação anti-spam Cloudflare Turnstile (invisível, só aparece se necessário). */
export function Turnstile({ onToken, ref }: { onToken: (t: string | undefined) => void; ref?: Ref<TurnstileHandle> }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string>(undefined);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onToken(undefined);
      if (id.current) window.turnstile?.reset(id.current);
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !el.current || !window.turnstile) return;
      id.current = window.turnstile.render(el.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        appearance: "interaction-only",
        language: "pt-br",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(undefined),
        "error-callback": () => onToken(undefined),
      });
    });
    return () => {
      cancelled = true;
      if (id.current) window.turnstile?.remove(id.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div className="turnstile" ref={el} />;
}

export const turnstileEnabled = Boolean(SITE_KEY);
