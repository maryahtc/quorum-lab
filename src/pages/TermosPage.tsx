import { Link } from "react-router-dom";
import { H, LegalPage, Ph } from "./LegalPage";

// RASCUNHO — REQUER REVISÃO JURÍDICA ANTES DO LANÇAMENTO PÚBLICO.
export default function TermosPage() {
  return (
    <LegalPage eyebrow="Quorum Lab" title="Termos de Prestação de Serviço" updated="outubro de 2026 (rascunho)">
      <H n={1}>Partes e objeto</H>
      <p>
        Estes termos regulam a solicitação de serviços de planejamento digital odontológico ao Quorum Lab (<Ph>razão social</Ph>,
        CNPJ <Ph>número</Ph>), doravante “Quorum Lab”, por cirurgiões-dentistas e clínicas odontológicas, doravante “Solicitante”,
        por meio deste formulário.
      </p>
      <p>Os serviços oferecidos são Smile Design, enceramento digital e PerioGuide, conforme descritos no formulário de solicitação.</p>

      <H n={2}>Natureza da solicitação</H>
      <p>
        O envio do formulário constitui apenas uma <strong>solicitação</strong>. Ele não representa o início automático do planejamento
        nem o aceite do trabalho pelo Quorum Lab. Em até 24 horas o Quorum Lab confere a documentação e confirma ao Solicitante o
        aceite, o prazo e o valor final do trabalho. O planejamento só tem início após essa confirmação.
      </p>

      <H n={3}>Valores</H>
      <ul>
        <li>Os valores exibidos no formulário são <strong>estimativas</strong> calculadas a partir das opções informadas.</li>
        <li>O enceramento é cobrado por elemento selecionado para enceramento.</li>
        <li>O valor do PerioGuide é “a partir de” e será confirmado após a análise da documentação.</li>
        <li>Condições de pagamento e emissão de nota fiscal: <Ph>definir</Ph>.</li>
      </ul>

      <H n={4}>Responsabilidades do Solicitante</H>
      <ul>
        <li>Fornecer informações verdadeiras e documentação completa, legível e adequada ao serviço solicitado.</li>
        <li>
          Obter do paciente as autorizações necessárias para o compartilhamento de suas imagens e exames com o Quorum Lab, para a
          finalidade de planejamento.
        </li>
        <li>Identificar o paciente apenas por iniciais ou código interno, evitando o envio de dados pessoais desnecessários.</li>
      </ul>

      <H n={5}>Natureza do planejamento</H>
      <p>
        O planejamento digital é uma ferramenta de apoio. O diagnóstico, a indicação, a decisão clínica e a execução do tratamento são
        de responsabilidade exclusiva do cirurgião-dentista responsável pelo paciente.
      </p>
      <p>Prazos, revisões incluídas e formato de entrega: <Ph>definir</Ph>.</p>

      <H n={6}>Documentação e arquivos</H>
      <p>
        Os arquivos enviados são armazenados temporariamente apenas para a triagem e excluídos automaticamente em até 7 dias.
        O tratamento de dados está descrito na <Link to="/privacidade">Política de Privacidade</Link>.
      </p>

      <H n={7}>Propriedade intelectual</H>
      <p><Ph>Definir titularidade e condições de uso dos arquivos e materiais de planejamento entregues.</Ph></p>

      <H n={8}>Cancelamento</H>
      <p><Ph>Definir condições de cancelamento antes e depois do aceite.</Ph></p>

      <H n={9}>Disposições gerais e foro</H>
      <p>
        Estes termos podem ser atualizados, valendo sempre a versão vigente na data da solicitação. Fica eleito o foro da comarca de{" "}
        <Ph>cidade/UF</Ph>. Contato: <Ph>e-mail</Ph>.
      </p>
    </LegalPage>
  );
}
