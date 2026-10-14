import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { TextArea, TextField } from "../../../components/fields";
import { AnaliseBlock } from "./AnaliseBlock";
import { DecisaoSimbolo } from "./DecisaoSimbolo";
import { ImagemInvalida, imagensDe, liberar, prepararImagem } from "./images";
import {
  ARQUIVOS, DECISAO_TIPOS, LEITURA_IDEAL, SERVICOS, SUGESTOES_ORIENTACAO,
  analisesValidas, arquivosTexto, dataTexto, decisaoTipo, decisoesValidas, entregaVazia, nomeArquivo,
  novoId, orientacoesValidas, reducer, servicoTexto, temConteudo, type Acao, type Entrega,
} from "./model";

type CampoTexto = Extract<Acao, { t: "campo" }>["campo"];
import "./entrega.css";

const SECOES = [
  { id: "identificacao", titulo: "Identificação" },
  { id: "leitura", titulo: "Leitura do caso" },
  { id: "planejamento", titulo: "Planejamento" },
  { id: "decisoes", titulo: "Decisões" },
  { id: "orientacoes", titulo: "Orientações" },
  { id: "arquivos", titulo: "Arquivos" },
  { id: "resumo", titulo: "Resumo" },
] as const;

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const TECLA_COLAR = isMac ? "⌘ V" : "Ctrl + V";

const focar = (selector: string) => requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());

export default function EntregaPage() {
  const [e, dispatch] = useReducer(reducer, undefined, entregaVazia);
  const [carregando, setCarregando] = useState<Set<string>>(new Set());
  const [erros, setErros] = useState<Record<string, string>>({});
  const [gerando, setGerando] = useState<"preview" | "download" | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [baixado, setBaixado] = useState<string | null>(null);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [dragPagina, setDragPagina] = useState(false);
  const pdfUrls = useRef<string[]>([]);

  const estado = useRef(e);
  estado.current = e;
  const carregandoRef = useRef(carregando);
  carregandoRef.current = carregando;

  useEffect(() => {
    document.title = "Entrega do planejamento · Quorum Lab";
  }, []);

  // Nada é salvo: avisa antes de fechar a aba com o caso preenchido.
  useEffect(() => {
    const h = (ev: BeforeUnloadEvent) => {
      if (temConteudo(estado.current) && !baixado) ev.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [baixado]);

  /* ------------------------------ imagens ------------------------------ */

  const definirImagem = useCallback(async (id: string, file: File) => {
    setCarregando((s) => new Set(s).add(id));
    setErros(({ [id]: _, ...rest }) => rest);
    try {
      const imagem = await prepararImagem(file);
      const atual = estado.current.analises.find((a) => a.id === id);
      if (!atual) return liberar(imagem); // análise excluída enquanto processava
      liberar(atual.imagem);
      dispatch({ t: "analise/set", id, patch: { imagem } });
    } catch (err) {
      setErros((m) => ({ ...m, [id]: err instanceof ImagemInvalida ? err.message : "Não foi possível ler esta imagem." }));
    } finally {
      setCarregando((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }, []);

  const novaAnalise = useCallback(
    (file?: File) => {
      const id = novoId("a");
      dispatch({ t: "analise/add", id });
      if (file) void definirImagem(id, file);
      requestAnimationFrame(() => document.querySelector(`[data-analise="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return id;
    },
    [definirImagem],
  );

  /** Distribui imagens coladas/soltas: análise em foco, última sem imagem, ou uma nova. */
  const receberImagens = useCallback(
    (files: File[], alvo?: string) => {
      const lista = estado.current.analises;
      files.forEach((file, i) => {
        if (i === 0) {
          const destino = alvo ?? (lista.length && !lista[lista.length - 1].imagem && !carregandoRef.current.has(lista[lista.length - 1].id) ? lista[lista.length - 1].id : undefined);
          if (destino) return void definirImagem(destino, file);
        }
        novaAnalise(file);
      });
    },
    [definirImagem, novaAnalise],
  );
  // Cmd/Ctrl + V em qualquer ponto da página.
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const files = imagensDe(ev.clipboardData);
      if (!files.length) return;
      const el = document.activeElement as HTMLElement | null;
      const emTexto = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      // Colando texto num campo: comportamento normal.
      if (emTexto && ev.clipboardData?.types.includes("text/plain")) return;
      ev.preventDefault();
      const bloco = el?.closest<HTMLElement>("[data-analise]");
      let alvo: string | undefined;
      if (bloco) {
        const id = bloco.dataset.analise!;
        const a = estado.current.analises.find((x) => x.id === id);
        // Na área da imagem: substitui. Num campo de uma análise sem imagem: preenche.
        if (el?.hasAttribute("data-drop-zone") || (a && !a.imagem)) alvo = id;
      }
      receberImagens(files, alvo);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [receberImagens]);

  // Arrastar para qualquer ponto da página cria análises; nunca abre o arquivo na aba.
  useEffect(() => {
    const over = (ev: DragEvent) => {
      if (!ev.dataTransfer?.types.includes("Files")) return;
      ev.preventDefault();
      setDragPagina(true);
    };
    const leave = (ev: DragEvent) => {
      if (!ev.relatedTarget) setDragPagina(false);
    };
    const drop = (ev: DragEvent) => {
      if (!ev.dataTransfer?.types.includes("Files")) return;
      ev.preventDefault();
      setDragPagina(false);
      const files = imagensDe(ev.dataTransfer);
      if (files.length) receberImagens(files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [receberImagens]);

  const removerAnalise = (id: string) => {
    liberar(e.analises.find((a) => a.id === id)?.imagem);
    dispatch({ t: "analise/remover", id });
  };

  /* ------------------------------- PDF -------------------------------- */

  async function gerar(modo: "preview" | "download") {
    if (gerando) return;
    // A aba da pré-visualização precisa abrir já no clique (bloqueio de pop-up).
    const win = modo === "preview" ? window.open("", "_blank") : null;
    if (win) win.document.title = "Gerando PDF…";
    setGerando(modo);
    setFalha(null);
    setPreviewLink(null);
    try {
      const { buildEntregaPdf } = await import("./pdf");
      const bytes = await buildEntregaPdf(estado.current);
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }));
      pdfUrls.current.push(url);
      if (modo === "preview") {
        if (win) win.location.href = url;
        else setPreviewLink(url);
      } else {
        const nome = nomeArquivo(estado.current);
        const a = document.createElement("a");
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setBaixado(nome);
      }
    } catch (err) {
      win?.close();
      console.error("Falha ao gerar o PDF", err instanceof Error ? err.message : err);
      setFalha("Não foi possível gerar o PDF. Verifique as imagens e tente novamente.");
    } finally {
      setGerando(null);
    }
  }

  function limpar() {
    estado.current.analises.forEach((a) => liberar(a.imagem));
    pdfUrls.current.forEach((u) => URL.revokeObjectURL(u));
    pdfUrls.current = [];
    dispatch({ t: "limpar" });
    setErros({});
    setBaixado(null);
    setFalha(null);
    setPreviewLink(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    focar('[data-campo="codigo"]');
  }

  useEffect(() => () => pdfUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  /* ------------------------------ render ------------------------------ */

  const set = (campo: CampoTexto) => (valor: string) => dispatch({ t: "campo", campo, valor });

  const addDecisao = () => {
    const id = novoId("d");
    dispatch({ t: "decisao/add", id });
    focar(`[data-decisao="${id}"] .d-elemento`);
  };
  const addOrientacao = (texto = "") => {
    const id = novoId("o");
    dispatch({ t: "orientacao/add", id, texto });
    if (!texto) focar(`[data-orientacao="${id}"] textarea`);
  };

  return (
    <div className="entrega" data-drag-page={dragPagina || undefined}>
      <nav className="entrega-index" aria-label="Seções">
        <ol>
          {SECOES.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section className="entrega-intro">
        <p className="eyebrow">Entrega do planejamento</p>
        <h1 className="display">Registro técnico</h1>
        <p className="lead">Print, frase, decisão, orientação. O PDF é gerado aqui mesmo e baixado no computador: nada é enviado nem armazenado.</p>
      </section>

      {/* 01 */}
      <Secao n={1} id="identificacao" titulo="Identificação">
        <div className="grid">
          <TextField
            data-campo="codigo"
            className="col-2"
            label="Código Quorum"
            value={e.codigo}
            onValue={(v) => set("codigo")(v.toUpperCase())}
            placeholder="QL-261013-7KF3"
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
          />
          <TextField className="col-4" label="Clínica" value={e.clinica} onValue={set("clinica")} maxLength={120} autoComplete="off" />
          <TextField className="col-4" label="Dentista solicitante" value={e.dentista} onValue={set("dentista")} maxLength={120} autoComplete="off" />
          <TextField className="col-2" label="Paciente / iniciais" value={e.paciente} onValue={set("paciente")} maxLength={40} autoComplete="off" placeholder="MC" />
          <div className="col-6 field">
            <span className="label" id="servico-label">Serviço</span>
            <div className="chips chips-servico" role="radiogroup" aria-labelledby="servico-label">
              {SERVICOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={e.servico === s.id}
                  onClick={() => {
                    dispatch({ t: "servico", valor: s.id });
                    if (s.id === "outro") focar('[data-campo="servico-outro"]');
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {e.servico === "outro" && (
            <TextField data-campo="servico-outro" className="col-4" label="Qual serviço" value={e.servicoOutro} onValue={set("servicoOutro")} maxLength={120} />
          )}
          <TextField className="col-2" type="date" label="Data" value={e.data} onValue={set("data")} />
        </div>
      </Secao>

      {/* 02 */}
      <Secao n={2} id="leitura" titulo="Leitura do caso">
        <TextArea
          label="Leitura do caso"
          className="short"
          rows={3}
          value={e.leitura}
          onValue={set("leitura")}
          maxLength={1500}
          placeholder="Ex.: Planejamento desenvolvido considerando proporção, exposição dentária, corredor bucal e preservação dos volumes existentes."
          hint={
            <span className="counter" data-over={e.leitura.length > LEITURA_IDEAL || undefined}>
              {e.leitura.length} caracteres · ideal até {LEITURA_IDEAL} (2 a 4 linhas)
            </span>
          }
        />
      </Secao>

      {/* 03 */}
      <Secao n={3} id="planejamento" titulo="Planejamento" intro={<>Tire o print no software, volte aqui e cole com <kbd>{TECLA_COLAR}</kbd>, em qualquer ponto da página. Cada print vira uma análise; a ordem abaixo é a ordem do PDF.</>}>
        <div className="analises">
          {e.analises.map((a, i) => (
            <AnaliseBlock
              key={a.id}
              analise={a}
              index={i}
              total={e.analises.length}
              carregando={carregando.has(a.id)}
              erro={erros[a.id]}
              colar={TECLA_COLAR}
              onImagem={(f) => void definirImagem(a.id, f)}
              onRemoverImagem={() => {
                liberar(a.imagem);
                dispatch({ t: "analise/set", id: a.id, patch: { imagem: undefined } });
              }}
              onTitulo={(titulo) => dispatch({ t: "analise/set", id: a.id, patch: { titulo } })}
              onDescricao={(descricao) => dispatch({ t: "analise/set", id: a.id, patch: { descricao } })}
              onMover={(delta) => dispatch({ t: "analise/mover", id: a.id, delta })}
              onRemover={() => removerAnalise(a.id)}
            />
          ))}
        </div>
        <button type="button" className="add-btn" onClick={() => novaAnalise()}>
          <span aria-hidden="true">+</span> Adicionar análise
        </button>
        {!e.analises.length && <p className="empty-note">Ou simplesmente cole um print agora.</p>}
      </Secao>

      {/* 04 */}
      <Secao n={4} id="decisoes" titulo="Decisões do planejamento">
        {e.decisoes.length > 0 && (
          <div className="decisoes">
            {e.decisoes.map((d, i) => (
              <div key={d.id} className="decisao" data-decisao={d.id}>
                <span className="d-num">{String(i + 1).padStart(2, "0")}</span>
                <div className="d-tipos" role="radiogroup" aria-label={`Tipo da decisão ${i + 1}`}>
                  {DECISAO_TIPOS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={d.tipo === t.id}
                      aria-label={t.label}
                      title={t.label}
                      onClick={() => dispatch({ t: "decisao/set", id: d.id, patch: { tipo: t.id } })}
                    >
                      <DecisaoSimbolo tipo={t.id} />
                    </button>
                  ))}
                  <span className="d-tipo-label">{decisaoTipo(d.tipo).label}</span>
                </div>
                <label className="d-field">
                  <span className="sr-only">Elemento ou região</span>
                  <input
                    className="d-elemento"
                    value={d.elemento}
                    maxLength={60}
                    placeholder="12 · 11 e 21 · 13 a 23"
                    onChange={(ev) => dispatch({ t: "decisao/set", id: d.id, patch: { elemento: ev.target.value } })}
                  />
                </label>
                <label className="d-field d-field-desc">
                  <span className="sr-only">Descrição</span>
                  <input
                    className="d-descricao"
                    value={d.descricao}
                    maxLength={200}
                    placeholder="+0,6 mm distal"
                    onChange={(ev) => dispatch({ t: "decisao/set", id: d.id, patch: { descricao: ev.target.value } })}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" && i === e.decisoes.length - 1) {
                        ev.preventDefault();
                        addDecisao();
                      }
                    }}
                  />
                </label>
                <button type="button" className="icon-btn d-remover" aria-label={`Excluir decisão ${i + 1}`} onClick={() => dispatch({ t: "decisao/remover", id: d.id })}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="add-btn" onClick={addDecisao}>
          <span aria-hidden="true">+</span> Adicionar decisão
        </button>
        {e.decisoes.length > 0 && <p className="empty-note">Enter na última descrição adiciona a próxima decisão.</p>}
      </Secao>

      {/* 05 */}
      <Secao n={5} id="orientacoes" titulo="Orientações para execução">
        <div className="chips chips-frases" role="group" aria-label="Frases sugeridas">
          {SUGESTOES_ORIENTACAO.map((s) => {
            const usada = e.orientacoes.find((o) => o.texto === s);
            return (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={!!usada}
                onClick={() => (usada ? dispatch({ t: "orientacao/remover", id: usada.id }) : addOrientacao(s))}
              >
                {s}
              </button>
            );
          })}
        </div>
        {e.orientacoes.length > 0 && (
          <ol className="orientacoes">
            {e.orientacoes.map((o, i) => (
              <li key={o.id} data-orientacao={o.id}>
                <span className="o-num">{String(i + 1).padStart(2, "0")}</span>
                <label className="o-field">
                  <span className="sr-only">Orientação {i + 1}</span>
                  <textarea
                    rows={1}
                    value={o.texto}
                    maxLength={400}
                    placeholder="Escreva a orientação"
                    onChange={(ev) => dispatch({ t: "orientacao/set", id: o.id, texto: ev.target.value })}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" && !ev.shiftKey) {
                        ev.preventDefault();
                        if (i === e.orientacoes.length - 1) addOrientacao();
                      }
                    }}
                  />
                </label>
                <button type="button" className="icon-btn" aria-label={`Excluir orientação ${i + 1}`} onClick={() => dispatch({ t: "orientacao/remover", id: o.id })}>
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="add-btn" onClick={() => addOrientacao()}>
          <span aria-hidden="true">+</span> Frase livre
        </button>
      </Secao>

      {/* 06 */}
      <Secao n={6} id="arquivos" titulo="Arquivos da entrega" intro="Apenas registra no PDF o que acompanha a entrega. Os arquivos são anexados por você no e-mail ou WhatsApp.">
        <div className="checks">
          {ARQUIVOS.map((a) => (
            <label key={a.id} className="consent check">
              <input type="checkbox" checked={e.arquivos.includes(a.id)} onChange={() => {
                dispatch({ t: "arquivo", id: a.id });
                if (a.id === "outro" && !e.arquivos.includes("outro")) focar('[data-campo="arquivo-outro"]');
              }} />
              <span>{a.label}</span>
            </label>
          ))}
        </div>
        {e.arquivos.includes("outro") && (
          <div className="grid" style={{ marginTop: 28 }}>
            <TextField data-campo="arquivo-outro" className="col-4" label="Outro arquivo" value={e.arquivoOutro} onValue={set("arquivoOutro")} maxLength={120} />
          </div>
        )}
      </Secao>

      {/* 07 */}
      <Secao n={7} id="resumo" titulo="Resumo">
        <Resumo e={e} />

        <div className="acoes">
          <button type="button" className="btn" onClick={() => gerar("preview")} disabled={!!gerando || carregando.size > 0}>
            {gerando === "preview" ? "Gerando…" : "Pré-visualizar PDF"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => gerar("download")} disabled={!!gerando || carregando.size > 0}>
            {gerando === "download" ? "Gerando…" : "Gerar e baixar PDF"}
          </button>
        </div>
        {carregando.size > 0 && <p className="form-alert">Aguarde o processamento das imagens.</p>}
        {previewLink && (
          <p className="form-alert">
            O navegador bloqueou a nova aba. <a href={previewLink} target="_blank" rel="noreferrer">Abrir a pré-visualização</a>.
          </p>
        )}
        {falha && <p className="form-alert" role="alert"><strong>Erro.</strong> {falha}</p>}
        {baixado && (
          <div className="baixado" role="status">
            <p>
              <span className="gold">PDF baixado</span> · <span className="nome">{baixado}</span>
            </p>
            <p className="muted">Anexe o PDF, os STL, os guias e os demais arquivos no e-mail ou WhatsApp do caso.</p>
            <button type="button" className="btn-outline" onClick={limpar}>Limpar e criar novo</button>
          </div>
        )}
      </Secao>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Secao({ n, id, titulo, intro, children }: { n: number; id: string; titulo: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="secao" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="step-head">
        <span className="num">{String(n).padStart(2, "0")}</span>
        <span className="slash" aria-hidden="true">/</span>
        <h2 id={`${id}-titulo`}>{titulo}</h2>
      </div>
      {intro && <p className="step-intro">{intro}</p>}
      {children}
    </section>
  );
}

function Resumo({ e }: { e: Entrega }) {
  const analises = analisesValidas(e);
  const semImagem = analises.filter((a) => !a.imagem).length;
  const arquivos = arquivosTexto(e);
  const v = (s: string) => (s.trim() ? s : <span className="muted">—</span>);
  const rows: [string, ReactNode][] = [
    ["Código", v(e.codigo)],
    ["Clínica", v(e.clinica)],
    ["Dentista", v(e.dentista)],
    ["Paciente", v(e.paciente)],
    ["Serviço", v(servicoTexto(e))],
    ["Data", v(dataTexto(e.data))],
    ["Análises", <>{analises.length}{semImagem ? <span className="muted"> · {semImagem} sem imagem</span> : null}</>],
    ["Decisões", decisoesValidas(e).length],
    ["Orientações", orientacoesValidas(e).length],
    ["Arquivos", arquivos.length ? arquivos.join(" · ") : <span className="muted">nenhum marcado</span>],
    ["Nome do PDF", <span className="nome">{nomeArquivo(e)}</span>],
  ];
  return (
    <dl className="resumo">
      {rows.map(([k, val]) => (
        <div key={k} className="review-row">
          <dt>{k}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}
