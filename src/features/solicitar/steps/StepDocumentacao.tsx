import { useRef, useState, type DragEvent } from "react";
import { OptionList, TextField } from "../../../components/fields";
import { DOC_SLOTS, DOC_SLOT_ORDER, SERVICES, SMILECLOUD_EMAIL, type DocSlot, type DocRequirement } from "../../../shared/config";
import { formatBytes } from "../../../shared/format";
import { checkFile, previewUrl } from "../fileClient";
import type { StepProps } from "./types";

export function StepDocumentacao({ state, patch, errors }: StepProps) {
  if (!state.servico.tipo) return <p className="lead">Selecione o tipo de trabalho na etapa 03.</p>;
  const docs = SERVICES[state.servico.tipo].documentos;
  const doc = state.documentacao;
  const smilecloud = doc.origem === "smilecloud";
  return (
    <>
      <OptionList
        question="Como prefere enviar a documentação?"
        value={doc.origem}
        options={[
          { value: "upload", label: "Enviar os arquivos aqui", description: "Foto, STL e tomografia pelo próprio formulário" },
          { value: "smilecloud", label: "Já está no Smilecloud", description: "Convidar o Quorum Lab para o caso no Smilecloud" },
        ]}
        onChange={(v) => patch("documentacao", { origem: v })}
        error={errors["documentacao.origem"]}
      />

      {smilecloud && <SmilecloudBox state={state} patch={patch} errors={errors} />}

      {doc.origem && (
        <section className="group" aria-labelledby="g-arquivos">
          <div className="group-title"><h3 id="g-arquivos">{smilecloud ? "Arquivos adicionais (opcional)" : "Arquivos"}</h3></div>
          <p className="step-intro" style={{ margin: "0 0 28px" }}>
            {smilecloud
              ? "Se quiser, anexe aqui algum arquivo que não esteja no Smilecloud."
              : "Os arquivos são enviados com segurança e ficam disponíveis ao Quorum Lab apenas pelo período necessário para a triagem."}
          </p>
          <div className="docs">
            {DOC_SLOT_ORDER.filter((s) => docs[s]).map((slot) => (
              <DocSlotField key={slot} slot={slot} rule={smilecloud ? "opcional" : docs[slot]!} state={state} patch={patch} error={errors[`arquivos.${slot}`]} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function SmilecloudBox({ state, patch, errors }: StepProps) {
  const doc = state.documentacao;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SMILECLOUD_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* cópia é só uma conveniência */
    }
  };
  return (
    <div className="doc smilecloud" style={{ marginTop: 40 }}>
      <h3 className="doc-title">Convite do caso no Smilecloud</h3>
      <p className="doc-instr">
        No Smilecloud, abra o caso do paciente e convide o Quorum Lab usando o e-mail abaixo.
        Confira se a foto do sorriso e os arquivos do planejamento estão no caso.
      </p>
      <div className="smile-email">
        <span>{SMILECLOUD_EMAIL}</span>
        <button type="button" className="text-btn" onClick={copy}>{copied ? "Copiado" : "Copiar e-mail"}</button>
      </div>
      <div className="grid" style={{ marginTop: 32 }}>
        <TextField
          className="col-6"
          label="Link do caso no Smilecloud"
          value={doc.smilecloudLink}
          onValue={(v) => patch("documentacao", { smilecloudLink: v })}
          hint="Opcional. Ajuda a localizar o caso mais rápido."
          inputMode="url"
          maxLength={500}
          placeholder="https://"
        />
      </div>
      <label className="consent">
        <input
          type="checkbox"
          checked={doc.smilecloudConvite}
          onChange={(e) => patch("documentacao", { smilecloudConvite: e.target.checked })}
          aria-invalid={errors["documentacao.smilecloudConvite"] ? true : undefined}
        />
        <span>Já enviei o convite do caso no Smilecloud para {SMILECLOUD_EMAIL}.</span>
      </label>
      {errors["documentacao.smilecloudConvite"] && <span className="error" role="alert">{errors["documentacao.smilecloudConvite"]}</span>}
    </div>
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
