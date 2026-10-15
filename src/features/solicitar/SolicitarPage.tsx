import { useCallback, useEffect, useRef, useState } from "react";
import { STEPS, initialState, validateStep, type Errors, type FormState } from "./state";
import { StepClinica } from "./steps/StepClinica";
import { StepClinico } from "./steps/StepClinico";
import { StepComunicacao } from "./steps/StepComunicacao";
import { StepDocumentacao } from "./steps/StepDocumentacao";
import { StepPaciente } from "./steps/StepPaciente";
import { StepRevisao } from "./steps/StepRevisao";
import { StepServico } from "./steps/StepServico";
import type { Patch } from "./steps/types";
import { SubmitError, submitRequest, type Stage, type SubmitSession } from "./submitClient";
import { Turnstile, type TurnstileHandle } from "./Turnstile";

type Phase = { kind: "form" } | { kind: "sending"; stage: Stage; progress: number } | { kind: "error"; message: string } | { kind: "done"; code: string; email: string; confirmacao: boolean };

export default function SolicitarPage() {
  const [state, setState] = useState<FormState>(initialState);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const startedAt = useRef(Date.now());
  const session = useRef<SubmitSession>({ uploaded: new Set() });
  const turnstile = useRef<TurnstileHandle>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = "Solicitar planejamento · Quorum Lab";
  }, []);

  // Evita perda acidental do preenchimento.
  useEffect(() => {
    const dirty = phase.kind !== "done" && (state.clinica.razaoSocial || state.servico.tipo || Object.keys(state.arquivos).length);
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state, phase.kind]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    heading.current?.focus({ preventScroll: true });
  }, [step, phase.kind]);

  const patch: Patch = useCallback((section, value) => {
    setState((s) => ({ ...s, [section]: { ...s[section], ...value } }));
    setErrors((e) => {
      const keys = Object.keys(value).map((k) => `${section}.${k}`);
      if (!keys.some((k) => k in e)) return e;
      const next = { ...e };
      keys.forEach((k) => delete next[k]);
      return next;
    });
    // Arquivos já enviados deixam de valer se a documentação mudar.
    if (section === "arquivos" || section === "servico") session.current = { uploaded: new Set() };
  }, []);

  const goTo = (i: number) => {
    setErrors({});
    setStep(i);
  };

  const next = () => {
    const e = validateStep(step, state);
    if (Object.keys(e).length) {
      setErrors(e);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true'], .error")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setErrors({});
    const n = step + 1;
    setStep(n);
    setReached((r) => Math.max(r, n));
  };

  async function send() {
    // Revalida tudo antes do envio.
    for (let i = 0; i < STEPS.length; i++) {
      const e = validateStep(i, state);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(i);
        return;
      }
    }
    setPhase({ kind: "sending", stage: "preparando", progress: 0 });
    try {
      const r = await submitRequest(state, session.current, {
        startedAt: startedAt.current,
        getTurnstileToken: async () => turnstile.current?.getToken(),
        onStage: (stage) => setPhase((p) => ({ kind: "sending", stage, progress: p.kind === "sending" ? p.progress : 0 })),
        onProgress: (progress) => setPhase((p) => (p.kind === "sending" ? { ...p, progress } : p)),
      });
      Object.values(state.arquivos).forEach((f) => f?.previewUrl && URL.revokeObjectURL(f.previewUrl));
      setPhase({ kind: "done", code: r.code, email: state.clinica.email, confirmacao: r.confirmacaoEnviada });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof SubmitError ? e.message : "Não foi possível concluir o envio. Tente novamente." });
    }
  }

  function restart() {
    setState(initialState());
    setStep(0);
    setReached(0);
    setErrors({});
    session.current = { uploaded: new Set() };
    startedAt.current = Date.now();
    setPhase({ kind: "form" });
  }

  // O Turnstile fica sempre montado, na mesma posição da árvore, durante o
  // formulário e as telas de envio/erro: assim "Tentar novamente" consegue
  // gerar um token novo sem recriar o widget no meio do envio.
  return (
    <>
      {phase.kind === "done" ? (
        <Done {...phase} onNew={restart} headingRef={heading} />
      ) : phase.kind === "sending" || phase.kind === "error" ? (
        <Sending phase={phase} onRetry={send} onBack={() => setPhase({ kind: "form" })} headingRef={heading} />
      ) : (
        renderForm()
      )}
      <Turnstile ref={turnstile} />
    </>
  );

  function renderForm() {

  const current = STEPS[step];
  const props = { state, patch, errors };
  const isLast = step === STEPS.length - 1;

  const nav = (
    <div className="nav">
      {step > 0 ? (
        <button type="button" className="btn-ghost" onClick={() => goTo(step - 1)}>← Voltar</button>
      ) : <span />}
      {isLast ? (
        <button type="button" className="btn btn-primary" onClick={send}>Enviar solicitação</button>
      ) : (
        <button type="button" className="btn" onClick={next}>Continuar <span className="arrow">→</span></button>
      )}
    </div>
  );

  return (
    <>
      {step === 0 && (
        <div className="intro">
          <p className="eyebrow">Quorum Lab</p>
          <h1 className="display">Solicitação de planejamento</h1>
          <p className="lead">Preencha os dados da clínica e do caso e envie a documentação. A triagem é feita pela equipe do Quorum Lab em até 24 horas.</p>
        </div>
      )}
      {step > 0 && <div style={{ height: 64 }} />}

      <nav className="progress" aria-label="Etapas">
        <div className="compact" aria-hidden="true">
          <span><b>{String(step + 1).padStart(2, "0")}</b> / 07</span>
          <span>{current.title}</span>
        </div>
        <ol>
          {STEPS.map((s, i) => {
            const st = i === step ? "current" : i <= reached ? "done" : "todo";
            const reachable = i <= reached && i !== step;
            return (
              <li key={s.id} data-state={st}>
                <button type="button" data-reachable={reachable} onClick={() => reachable && goTo(i)} aria-current={i === step ? "step" : undefined} tabIndex={reachable ? 0 : -1}>
                  {String(i + 1).padStart(2, "0")}
                  <span className="step-name">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="bar"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </nav>

      <form className="step" key={current.id} onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="step-head">
          <span className="num">{String(step + 1).padStart(2, "0")}</span>
          <h2 ref={heading} tabIndex={-1}>{current.title}</h2>
        </div>

        {/* Honeypot: invisível para pessoas, preenchido por robôs. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label>Website<input tabIndex={-1} autoComplete="off" value={state.website} onChange={(e) => setState((s) => ({ ...s, website: e.target.value }))} /></label>
        </div>

        {step === 0 && <StepClinica {...props} />}
        {step === 1 && <StepPaciente {...props} />}
        {step === 2 && <StepServico {...props} />}
        {step === 3 && <StepClinico {...props} />}
        {step === 4 && <StepDocumentacao {...props} />}
        {step === 5 && <StepComunicacao {...props} />}
        {step === 6 && (
          <StepRevisao
            {...props}
            goTo={goTo}
            onConsent={(v) => {
              setState((s) => ({ ...s, aceiteTermos: v }));
              setErrors((e) => (e.aceiteTermos ? {} : e));
            }}
          />
        )}

        {Object.keys(errors).length > 0 && (
          <p className="form-alert" role="status"><strong>Revise os campos indicados</strong> antes de continuar.</p>
        )}
        {nav}
      </form>
    </>
  );
  }
}

const STAGES: { id: Stage; label: string }[] = [
  { id: "preparando", label: "Preparando envio seguro" },
  { id: "enviando", label: "Enviando documentação" },
  { id: "finalizando", label: "Gerando resumo e notificando o Quorum Lab" },
];

function Sending({ phase, onRetry, onBack, headingRef }: { phase: Extract<Phase, { kind: "sending" | "error" }>; onRetry: () => void; onBack: () => void; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const activeIndex = phase.kind === "sending" ? STAGES.findIndex((s) => s.id === phase.stage) : -1;
  return (
    <div className="sending step">
      <div className="intro" style={{ paddingBottom: 40 }}>
        <p className="eyebrow">{phase.kind === "error" ? "Envio interrompido" : "Enviando"}</p>
        <h1 className="display" ref={headingRef} tabIndex={-1}>{phase.kind === "error" ? "Não foi possível concluir" : "Enviando solicitação"}</h1>
        {phase.kind === "sending" && <p className="lead">Mantenha esta página aberta até a confirmação. Arquivos grandes, como tomografias, podem levar alguns minutos.</p>}
      </div>

      {phase.kind === "sending" && (
        <div aria-live="polite">
          {STAGES.map((s, i) => {
            const st = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
            return (
              <div className="stage" key={s.id} data-state={st}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <span>{s.label}</span>
                <span className="pct">{st === "done" ? "✓" : s.id === "enviando" && st === "active" ? `${Math.round(phase.progress * 100)}%` : ""}</span>
                {s.id === "enviando" && st !== "todo" && (
                  <div className="track"><span style={{ width: `${(st === "done" ? 1 : phase.progress) * 100}%` }} /></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {phase.kind === "error" && (
        <>
          <p className="form-alert" role="alert">{phase.message}</p>
          <p className="notice">Seus dados e arquivos continuam nesta página. Ao tentar novamente, o envio é retomado de onde parou.</p>
          <div className="nav">
            <button type="button" className="btn-ghost" onClick={onBack}>← Revisar dados</button>
            <button type="button" className="btn btn-primary" onClick={onRetry}>Tentar novamente</button>
          </div>
        </>
      )}
    </div>
  );
}

function Done({ code, email, confirmacao, onNew, headingRef }: { code: string; email: string; confirmacao: boolean; onNew: () => void; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="done step">
      <div style={{ height: 32 }} />
      <p className="eyebrow">Solicitação enviada</p>
      <h1 className="display" ref={headingRef} tabIndex={-1} style={{ marginTop: 18 }}>Recebemos sua solicitação</h1>
      <p className="code">{code}</p>
      <p className="lead">
        Nossa equipe irá conferir a documentação e confirmar o aceite, prazo e valor do trabalho em até 24 horas.
      </p>
      <p className="lead muted" style={{ marginTop: 16, fontSize: 14 }}>
        {confirmacao ? <>Uma confirmação foi enviada para <span style={{ color: "var(--ink)" }}>{email}</span>.</> : "Guarde o código acima para referência."}
      </p>
      <div className="rule" />
      <button type="button" className="btn-ghost" onClick={onNew}>Nova solicitação</button>
    </div>
  );
}

