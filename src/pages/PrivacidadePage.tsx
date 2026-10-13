import { H, LegalPage, Ph } from "./LegalPage";

// RASCUNHO — REQUER REVISÃO JURÍDICA ANTES DO LANÇAMENTO PÚBLICO (LGPD).
export default function PrivacidadePage() {
  return (
    <LegalPage eyebrow="Quorum Lab" title="Política de Privacidade" updated="outubro de 2026 (rascunho)">
      <H n={1}>Quem somos</H>
      <p>
        O Quorum Lab (<Ph>razão social</Ph>, CNPJ <Ph>número</Ph>, <Ph>endereço</Ph>) é o controlador dos dados tratados por meio deste
        formulário. Encarregado pelo tratamento de dados (DPO): <Ph>nome</Ph> — <Ph>e-mail</Ph>.
      </p>

      <H n={2}>Dados coletados</H>
      <ul>
        <li><strong>Da clínica e do profissional:</strong> razão social, nome fantasia, CNPJ, inscrição municipal, nome e CRO do solicitante, telefones, e-mails, Instagram e endereço.</li>
        <li><strong>Do paciente:</strong> apenas identificação por iniciais ou código interno, idade (opcional), observações e informações clínicas do caso.</li>
        <li><strong>Documentação clínica:</strong> fotografia do sorriso, arquivos STL e tomografia (DICOM), conforme o serviço.</li>
        <li><strong>Dados técnicos:</strong> endereço IP, usado exclusivamente para segurança, prevenção de spam e limite de requisições.</li>
      </ul>
      <p>Não solicitamos o nome completo do paciente. Pedimos que o Solicitante não o inclua nos campos ou nos nomes dos arquivos.</p>

      <H n={3}>Finalidades e bases legais</H>
      <ul>
        <li>Avaliar a solicitação, confirmar aceite, prazo e valor, e executar o planejamento contratado (art. 7º, V, LGPD).</li>
        <li>Dados de saúde do paciente: tratados para a tutela da saúde, em procedimento realizado por profissionais de saúde (art. 11, II, “f”, LGPD) <Ph>validar base legal</Ph>.</li>
        <li>Emissão de nota fiscal e obrigações legais (art. 7º, II, LGPD).</li>
        <li>Segurança do serviço e prevenção de fraudes (art. 7º, IX, LGPD).</li>
      </ul>

      <H n={4}>Como os dados circulam</H>
      <p>
        Este formulário não mantém banco de dados. Ao enviar a solicitação, um resumo em PDF e a documentação são encaminhados por
        e-mail à equipe do Quorum Lab, que registra o trabalho em seu sistema de gestão interno.
      </p>
      <p>
        Arquivos grandes são armazenados temporariamente em ambiente privado, acessíveis apenas por links protegidos e com prazo de
        validade. <strong>Esses arquivos são excluídos automaticamente em até 7 dias.</strong>
      </p>

      <H n={5}>Operadores e transferência internacional</H>
      <p>Utilizamos fornecedores que tratam dados em nosso nome, alguns com servidores fora do Brasil:</p>
      <ul>
        <li>Netlify — hospedagem do formulário;</li>
        <li>Cloudflare — armazenamento temporário de arquivos e verificação anti-spam;</li>
        <li>Resend — envio de e-mails;</li>
        <li>ViaCEP — consulta de endereço a partir do CEP.</li>
      </ul>
      <p><Ph>Validar cláusulas de transferência internacional (art. 33, LGPD).</Ph></p>

      <H n={6}>Retenção</H>
      <ul>
        <li>Arquivos no armazenamento temporário: até 7 dias.</li>
        <li>E-mails e registros no sistema de gestão: <Ph>definir prazo</Ph>, conforme obrigações legais e regulatórias.</li>
      </ul>

      <H n={7}>Direitos dos titulares</H>
      <p>
        Os titulares podem solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e
        informações sobre compartilhamento, nos termos do art. 18 da LGPD, pelo contato <Ph>e-mail</Ph>.
      </p>

      <H n={8}>Segurança</H>
      <p>
        Adotamos conexão criptografada, armazenamento privado, links temporários, validação de arquivos, limite de requisições e
        exclusão automática de arquivos temporários.
      </p>

      <H n={9}>Atualizações</H>
      <p>Esta política pode ser atualizada. A versão vigente estará sempre disponível nesta página.</p>
    </LegalPage>
  );
}
