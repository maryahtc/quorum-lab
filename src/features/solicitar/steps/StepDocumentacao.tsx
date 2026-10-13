import { useRef, useState, type DragEvent } from "react";
import { DOC_SLOTS, DOC_SLOT_ORDER, SERVICES, type DocSlot, type DocRequirement } from "../../../shared/config";
import { formatBytes } from "../../../shared/format";
import { checkFile, previewUrl } from "../fileClient";
import type { StepProps } from "./types";

export function StepDocumentacao({ state, patch, errors }: StepProps) {
  if (!state.servico.tipo) return <p className="lead">Selecione o tipo de trabalho na etapa 03.</p>;
  const docs = SERVICES[state.servico.tipo].documentos;
  return (
    <>
      <p className="step-intro">Os arquivos são enviados com segurança e ficam disponíveis ao Quorum Lab apenas pelo período necessário para a triagem.</p>
      <div className="docs">
        {DOC_SLOT_ORDER.filter((s) => docs[s]).map((slot) => (
          <DocSlotField key={slot} slot={slot} rule={docs[slot]!} state={state} patch={patch} error={errors[`arquivos.${slot}`]} />
        ))}
      </div>
    </>
  );
}

function DocSlotField({ slot, rule, state, patch, error }: { slot: DocSlot; rule: DocRequirement; error?: string } & Pick<StepProps, "state" | "patch">) {
  const def = DOC_SLOTS[slot];
  const current = state.arquivos[slot];
  const input = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [drag, setDrag] = useState(false);
  const accept = def.extensoes.map((e) => "." + e).join(",");

  async function take(file: File | undefined) {
    if (!file) return;
    setChecking(true);
    setLocalError(undefined);
    const problem = await checkFile(slot, file);
    if (problem) {
      setLocalError(problem);
      setChecking(false);
      return;
    }
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    patch("arquivos", { [slot]: { file } });
    setChecking(false);
    if (def.kind === "image") {
      const url = await previewUrl(file);
      patch("arquivos", { [slot]: { file, previewUrl: url } });
    }
  }

  function remove() {
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    patch("arquivos", { [slot]: undefined });
    if (input.current) input.current.value = "";
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    take(e.dataTransfer.files[0]);
  };

  const maxLabel = def.maxMB >= 1024 ? `${def.maxMB / 1024} GB` : `${def.maxMB} MB`;
  const shownError = localError ?? error;

  return (
    <div
      className="doc"
      data-drag={drag || undefined}
      data-invalid={shownError ? "true" : undefined}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <div className="doc-head">
        <h3 className="doc-title">{def.titulo}</h3>
        <span className="doc-tag" data-required={rule === "obrigatorio"}>{rule === "obrigatorio" ? "Obrigatório" : "Opcional"}</span>
      </div>
      <p className="doc-meta">{def.extensoes.map((e) => "." + e.toUpperCase()).join(" · ")} — até {maxLabel}</p>
      {def.instrucao && <p className="doc-instr">{def.instrucao}</p>}

      <input ref={input} type="file" accept={accept} hidden onChange={(e) => take(e.target.files?.[0])} />

      {!current ? (
        <div className="doc-drop">
          <button type="button" className="btn-outline" onClick={() => input.current?.click()} disabled={checking}>
            {checking ? "Verificando…" : "Selecionar arquivo"}
          </button>
          <span className="muted">ou arraste o arquivo até aqui</span>
        </div>
      ) : (
        <>
          <div className="doc-file">
            <span className="name" title={current.file.name}>
              <span className="ok" aria-hidden="true">✓</span>
              {current.file.name}
              <span className="size">{formatBytes(current.file.size)}</span>
            </span>
            <span style={{ display: "flex", gap: 20, flexShrink: 0 }}>
              <button type="button" className="text-btn" onClick={() => input.current?.click()}>Substituir</button>
              <button type="button" className="text-btn" onClick={remove}>Remover</button>
            </span>
          </div>
          {def.kind === "image" && (
            <div className="doc-preview">
              {current.previewUrl ? <img src={current.previewUrl} alt="Pré-visualização da foto do sorriso" /> : <span className="pending">Gerando pré-visualização…</span>}
            </div>
          )}
        </>
      )}
      {shownError && <span className="error" role="alert">{shownError}</span>}
    </div>
  );
}
