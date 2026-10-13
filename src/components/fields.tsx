import { useId, type InputHTMLAttributes, type Ref, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface Base {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
}

function Shell({ id, label, required, error, hint, className, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`field ${className ?? ""}`} data-invalid={error ? "true" : undefined}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <span className="error" id={`${id}-err`} role="alert">{error}</span>
      ) : hint ? (
        <span className="hint" id={`${id}-hint`}>{hint}</span>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export function TextField({ label, required, error, hint, className, onValue, ref, ...rest }: Base & Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { onValue: (v: string) => void; ref?: Ref<HTMLInputElement> }) {
  const id = useId();
  return (
    <Shell id={id} {...{ label, required, error, hint, className }}>
      <input
        ref={ref}
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(e) => onValue(e.target.value)}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({ label, required, error, hint, className, onValue, children, ...rest }: Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & { onValue: (v: string) => void }) {
  const id = useId();
  return (
    <Shell id={id} {...{ label, required, error, hint, className }}>
      <select id={id} aria-required={required || undefined} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} onChange={(e) => onValue(e.target.value)} {...rest}>
        {children}
      </select>
    </Shell>
  );
}

export function TextArea({ label, required, error, hint, className, onValue, ...rest }: Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { onValue: (v: string) => void }) {
  const id = useId();
  return (
    <Shell id={id} {...{ label, required, error, hint, className }}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} onChange={(e) => onValue(e.target.value)} {...rest} />
    </Shell>
  );
}

/** Pergunta com opções curtas lado a lado (Sim / Não …). */
export function Segmented<T extends string>({ question, value, options, onChange, error }: { question: string; value: T | ""; options: { value: T; label: string }[]; onChange: (v: T) => void; error?: string }) {
  const id = useId();
  return (
    <div className="question">
      <p className="q-text" id={id}>{question}</p>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}

/** Pergunta com opções descritas, em lista editorial com filetes. */
export function OptionList<T extends string>({ question, value, options, onChange, error }: { question: string; value: T | ""; options: { value: T; label: string; description?: string }[]; onChange: (v: T) => void; error?: string }) {
  const id = useId();
  return (
    <div className="question">
      <p className="q-text" id={id}>{question}</p>
      <div className="options" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.value} type="button" className="option" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
            <span className="mark" aria-hidden="true" />
            <span>
              <span className="o-title">{o.label}</span>
              {o.description && <span className="o-desc">{o.description}</span>}
            </span>
          </button>
        ))}
      </div>
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}
