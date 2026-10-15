import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      execute: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

export interface TurnstileHandle {
  /**
   * Gera um token novo na hora do envio. Tokens do Turnstile valem uma única
   * vez e expiram em 5 minutos, por isso nunca são reaproveitados.
   * Retorna undefined quando o Turnstile não está configurado.
   */
  getToken: () => Promise<string | undefined>;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 45_000;

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

export class TurnstileError extends Error {}

/**
 * Verificação anti-spam Cloudflare Turnstile. Fica montada durante todo o
 * preenchimento (inclusive nas telas de envio e erro) e só executa quando
 * getToken() é chamado. Normalmente é invisível; só aparece se a Cloudflare
 * precisar de uma interação.
 */
export function Turnstile({ ref }: { ref?: Ref<TurnstileHandle> }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string>(undefined);
  const ready = useRef<Promise<void>>(undefined);
  const pending = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void }>(undefined);

  useImperativeHandle(ref, () => ({
    getToken: async () => {
      if (!SITE_KEY) return undefined;
      try {
        await ready.current;
      } catch {
        throw new TurnstileError("Não foi possível carregar a verificação de segurança. Verifique a conexão e tente novamente.");
      }
      const ts = window.turnstile;
      if (!ts || !id.current) throw new TurnstileError("Verificação de segurança indisponível. Atualize a página e tente novamente.");
      pending.current?.reject(new TurnstileError("Verificação substituída."));
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current = undefined;
          reject(new TurnstileError("A verificação de segurança demorou para responder. Tente novamente."));
        }, TOKEN_TIMEOUT_MS);
        pending.current = {
          resolve: (t) => { clearTimeout(timer); pending.current = undefined; resolve(t); },
          reject: (e) => { clearTimeout(timer); pending.current = undefined; reject(e); },
        };
        ts.reset(id.current);
        ts.execute(id.current!);
      });
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    ready.current = loadScript().then(() => {
      if (cancelled || !el.current || !window.turnstile) return;
      id.current = window.turnstile.render(el.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        appearance: "interaction-only",
        execution: "execute",
        language: "pt-br",
        callback: (t: string) => pending.current?.resolve(t),
      });
    });
    ready.current.catch(() => undefined);
    return () => {
      cancelled = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = undefined;
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div className="turnstile" ref={el} />;
}
