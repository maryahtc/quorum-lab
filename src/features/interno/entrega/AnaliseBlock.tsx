import { useRef, useState, type DragEvent } from "react";
import { TextArea, TextField } from "../../../components/fields";
import { ACEITOS_ATTR, imagensDe } from "./images";
import { SUGESTOES_TITULO, type Analise } from "./model";

interface Props {
  analise: Analise;
  index: number;
  total: number;
  carregando: boolean;
  erro?: string;
  colar: string;
  onImagem: (file: File) => void;
  onRemoverImagem: () => void;
  onTitulo: (v: string) => void;
  onDescricao: (v: string) => void;
  onMover: (delta: -1 | 1) => void;
  onRemover: () => void;
}

export function AnaliseBlock({ analise: a, index, total, carregando, erro, colar, onImagem, onRemoverImagem, onTitulo, onDescricao, onMover, onRemover }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const num = String(index + 1).padStart(2, "0");

  const escolher = () => input.current?.click();
  const soltar = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    const [file] = imagensDe(e.dataTransfer);
    if (file) onImagem(file);
  };

  const sugestaoAtiva = SUGESTOES_TITULO.find((s) => s === a.titulo);

  return (
    <article className="analise" data-analise={a.id} aria-label={`Análise ${num}`}>
      <header className="analise-head">
        <span className="analise-num">{num}</span>
        <span className="analise-titulo">{a.titulo.trim() || "Análise"}</span>
        <span className="analise-tools">
          <button type="button" className="icon-btn" onClick={() => onMover(-1)} disabled={index === 0} aria-label={`Mover análise ${num} para cima`}>↑</button>
          <button type="button" className="icon-btn" onClick={() => onMover(1)} disabled={index === total - 1} aria-label={`Mover análise ${num} para baixo`}>↓</button>
          <button type="button" className="text-btn" onClick={onRemover}>Excluir</button>
        </span>
      </header>

      <div
        className="drop"
        data-drag={drag || undefined}
        data-filled={a.imagem ? "true" : undefined}
        data-drop-zone
        tabIndex={0}
        role={a.imagem ? "group" : "button"}
        aria-label={a.imagem ? `Imagem da análise ${num}. Cole para substituir.` : `Inserir imagem da análise ${num}: cole, arraste ou clique para selecionar.`}
        onClick={() => !a.imagem && escolher()}
        onKeyDown={(e) => {
          if (!a.imagem && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            escolher();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={soltar}
      >
        {a.imagem ? (
          <img src={a.imagem.url} alt={`Print da análise ${num}`} width={a.imagem.largura} height={a.imagem.altura} />
        ) : carregando ? (
          <span className="drop-msg">Processando imagem…</span>
        ) : (
          <span className="drop-msg">
            <b>Cole o print</b> <kbd>{colar}</kbd>
            <span className="drop-alt">ou arraste a imagem · ou clique para selecionar</span>
            <span className="drop-fmt">JPG · PNG · WEBP</span>
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACEITOS_ATTR}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImagem(f);
          e.target.value = "";
        }}
      />
      {erro && <p className="error" role="alert">{erro}</p>}
      {a.imagem && (
        <div className="img-tools">
          <span className="muted">{a.imagem.largura} × {a.imagem.altura} px{carregando ? " · processando…" : ""}</span>
          <span>
            <button type="button" className="text-btn" onClick={escolher}>Substituir</button>
            <button type="button" className="text-btn" onClick={onRemoverImagem}>Remover imagem</button>
          </span>
        </div>
      )}

      <div className="analise-fields">
        <TextField ref={titulo} label="Título" value={a.titulo} onValue={onTitulo} maxLength={80} placeholder="Ex.: Vista frontal" />
        <div className="chips" role="group" aria-label="Sugestões de título">
          {SUGESTOES_TITULO.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={sugestaoAtiva === s} onClick={() => onTitulo(s)}>
              {s}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            aria-pressed={!!a.titulo && !sugestaoAtiva}
            onClick={() => {
              if (sugestaoAtiva) onTitulo("");
              titulo.current?.focus();
            }}
          >
            Outro
          </button>
        </div>
        <TextArea
          label="Descrição"
          className="short"
          rows={2}
          value={a.descricao}
          onValue={onDescricao}
          maxLength={700}
          placeholder="Ex.: Redistribuição dos espaços e adequação das proporções dos incisivos."
        />
      </div>
    </article>
  );
}
