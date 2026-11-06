import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  DOC_SLOTS,
  DOC_SLOT_ORDER,
  ENCERAMENTO_POR_ELEMENTO,
  SERVICES,
  SERVICE_ORDER,
  type ServiceDefinition,
} from "../../shared/config";
import { brl } from "../../shared/pricing";
import "./site.css";

/*
 * Site institucional (rota "/").
 * Serviços, valores e documentação vêm de src/shared/config.ts — a mesma fonte
 * do formulário. Mudou lá, muda aqui.
 */

const PRINCIPIOS = [
  {
    titulo: "Precisão",
    texto: "Cada decisão do planejamento é medida, registrada e justificada. Nada fica implícito no arquivo.",
  },
  {
    titulo: "Critério",
    texto: "Mais raciocínio do que ferramenta. O software executa; quem decide é a leitura clínica.",
  },
  {
    titulo: "Colaboração",
    texto: "Cada caso é lido em conjunto por profissionais que conhecem clínica, execução e previsibilidade.",
  },
];

const ETAPAS = [
  {
    titulo: "Solicitação",
    texto: "Você envia o caso pelo formulário online: dados da clínica, do paciente, serviço, dentes envolvidos e documentação.",
  },
  {
    titulo: "Conferência",
    texto: "Em até 24 horas conferimos a documentação e confirmamos aceite, prazo e valor do trabalho.",
  },
  {
    titulo: "Planejamento",
    texto: "O caso é lido e planejado pela equipe. As decisões são tomadas antes de qualquer arquivo ser gerado.",
  },
  {
    titulo: "Entrega",
    texto: "Você recebe um PDF técnico com leitura do caso, análises, decisões e orientações, junto com os arquivos do planejamento.",
  },
];

function valorServico(s: ServiceDefinition): { linhas: [string, string][]; nota?: string } {
  const linhas: [string, string][] = [["Smile Design", brl(s.smileDesign)]];
  if (s.enceramento) linhas.push(["Enceramento", `${brl(ENCERAMENTO_POR_ELEMENTO)} / elemento`]);
  if (s.perioGuideAPartirDe) linhas.push(["PerioGuide", `a partir de ${brl(s.perioGuideAPartirDe)}`]);
  const nota = s.perioGuideAPartirDe ? "Valor do PerioGuide confirmado após análise da documentação." : undefined;
  return { linhas, nota };
}

function documentos(s: ServiceDefinition) {
  return DOC_SLOT_ORDER.filter((slot) => s.documentos[slot]).map((slot) => ({
    slot,
    titulo: DOC_SLOTS[slot].titulo,
    opcional: s.documentos[slot] === "opcional",
  }));
}

function SectionHead({ id, num, title }: { id: string; num: string; title: string }) {
  return (
    <header className="home-head">
      <span className="num">{num}</span>
      <h2 id={id}>{title}</h2>
    </header>
  );
}

export default function HomePage() {
  useEffect(() => {
    document.title = "Quorum Lab · Planejamento digital odontológico";
  }, []);

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="hero-title">
        <p className="eyebrow">Laboratório de planejamento digital odontológico</p>
        <h1 id="hero-title" className="home-display">
          Precisão não é sorte.
          <br />
          <span className="gold">É método.</span>
        </h1>
        <p className="lead">
          Planejamento conduzido por profissionais que entendem clínica, execução e previsibilidade. Técnico antes de
          tecnológico.
        </p>
        <div className="home-actions">
          <Link to="/solicitar" className="btn btn-primary">
            Solicitar planejamento <span className="arrow">→</span>
          </Link>
          <a href="#processo" className="btn-ghost">
            Como funciona
          </a>
        </div>
      </section>

      <section className="home-section" aria-labelledby="s-abordagem">
        <SectionHead id="s-abordagem" num="01" title="Abordagem" />
        <p className="home-statement">
          Existe critério antes de existir arquivo.
        </p>
        <ul className="home-principles">
          {PRINCIPIOS.map((p) => (
            <li key={p.titulo}>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" id="servicos" aria-labelledby="s-servicos">
        <SectionHead id="s-servicos" num="02" title="Serviços" />
        <ol className="home-services">
          {SERVICE_ORDER.map((id, i) => {
            const s = SERVICES[id];
            const v = valorServico(s);
            return (
              <li key={id} className="home-service">
                <div className="home-service-main">
                  <span className="home-service-num">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{s.nome}</h3>
                    <p>{s.descricao}</p>
                    <p className="home-service-docs">
                      <span className="micro">Documentação</span>
                      {documentos(s).map((d) => (
                        <span key={d.slot} className="doc">
                          {d.titulo}
                          {d.opcional && <em> · opcional</em>}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
                <dl className="home-service-price">
                  {v.linhas.map(([k, val]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{val}</dd>
                    </div>
                  ))}
                  {v.nota && <p className="muted">{v.nota}</p>}
                </dl>
              </li>
            );
          })}
        </ol>
        <p className="home-note muted">
          No enceramento, só os dentes efetivamente encerados são cobrados. O valor estimado aparece no formulário
          conforme você marca os dentes no odontograma.
        </p>
      </section>

      <section className="home-section" id="processo" aria-labelledby="s-processo">
        <SectionHead id="s-processo" num="03" title="Processo" />
        <ol className="home-steps">
          {ETAPAS.map((e, i) => (
            <li key={e.titulo}>
              <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{e.titulo}</h3>
              <p>{e.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-cta" aria-labelledby="cta-title">
        <p className="eyebrow">Próximo caso</p>
        <h2 id="cta-title" className="home-display small">
          Planejar é antecipar o resultado.
        </h2>
        <Link to="/solicitar" className="btn btn-primary">
          Solicitar planejamento <span className="arrow">→</span>
        </Link>
      </section>
    </div>
  );
}
