import { LOWER_TEETH, UPPER_TEETH } from "../shared/config";
import { formatTeeth, sortTeeth } from "../shared/format";

const QUADRANTS = [
  { label: "Superior direito", teeth: UPPER_TEETH.slice(0, 8) },
  { label: "Superior esquerdo", teeth: UPPER_TEETH.slice(8) },
  { label: "Inferior direito", teeth: LOWER_TEETH.slice(0, 8) },
  { label: "Inferior esquerdo", teeth: LOWER_TEETH.slice(8) },
];

interface Props {
  label: string;
  value: number[];
  onChange: (teeth: number[]) => void;
  /** Dentes marcados com um filete discreto (ex.: dentes do Smile Design no enceramento). */
  hint?: number[];
}

/** Odontograma FDI (11–48), esquema técnico sem ilustração de dentes. */
export function Odontogram({ label, value, onChange, hint = [] }: Props) {
  const selected = new Set(value);
  const hinted = new Set(hint);
  const toggle = (t: number) => onChange(sortTeeth(selected.has(t) ? value.filter((x) => x !== t) : [...value, t]));

  return (
    <div className="odonto" role="group" aria-label={label}>
      <div className="odonto-chart">
        {QUADRANTS.map((q) => (
          <div className="quadrant" key={q.label}>
            <span className="q-label">{q.label}</span>
            {q.teeth.map((t) => (
              <button
                key={t}
                type="button"
                className="tooth"
                aria-pressed={selected.has(t)}
                data-hint={hinted.has(t) || undefined}
                aria-label={`Dente ${t}`}
                onClick={() => toggle(t)}
              >
                {t}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="odonto-legend" aria-hidden="true">
        <span>Direito</span>
        <span>Esquerdo</span>
      </div>
      <OdontoSummary teeth={value} />
    </div>
  );
}

export function OdontoSummary({ teeth }: { teeth: number[] }) {
  return (
    <div className="odonto-summary" aria-live="polite">
      <span className="count">
        <b>{teeth.length}</b> {teeth.length === 1 ? "elemento selecionado" : "elementos selecionados"}
      </span>
      <span className="teeth">{formatTeeth(teeth)}</span>
    </div>
  );
}

/** Seleção restrita a um conjunto de dentes já definido (ex.: resinas). */
export function ToothPicker({ label, options, value, onChange }: { label: string; options: number[]; value: number[]; onChange: (t: number[]) => void }) {
  const selected = new Set(value);
  return (
    <div role="group" aria-label={label}>
      <div className="teeth-row">
        {sortTeeth(options).map((t) => (
          <button
            key={t}
            type="button"
            className="tooth"
            aria-pressed={selected.has(t)}
            aria-label={`Dente ${t}`}
            onClick={() => onChange(sortTeeth(selected.has(t) ? value.filter((x) => x !== t) : [...value, t]))}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="odonto-summary">
        <span className="count"><b>{value.length}</b> {value.length === 1 ? "elemento com resina" : "elementos com resina"}</span>
        <span className="teeth">{formatTeeth(value)}</span>
      </div>
    </div>
  );
}

