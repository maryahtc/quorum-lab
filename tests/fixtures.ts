import type { Solicitacao } from "../src/shared/schema";

export const solicitacaoExemplo: Solicitacao = {
  clinica: {
    razaoSocial: "Clínica Odontológica Exemplo Ltda.",
    nomeFantasia: "Clínica Exemplo",
    cnpj: "11.222.333/0001-81",
    inscricaoMunicipal: "",
    solicitante: "Dra. Ana Exemplo",
    cro: "CRO-SP 12345",
    telefone: "(11) 3333-4444",
    whatsapp: "(11) 98888-7777",
    email: "contato@exemplo.com.br",
    emailNotaFiscal: "",
    instagram: "@clinicaexemplo",
    cep: "01310-100",
    rua: "Avenida Paulista",
    numero: "1000",
    complemento: "Conj. 101",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
  },
  paciente: { identificacao: "M.A.S. · 0042", idade: "34", observacoes: "Paciente com expectativa de resultado natural. 🙂" },
  servico: {
    tipo: "smile_enceramento_perioguide",
    dentesSmile: [13, 12, 11, 21, 22, 23],
    dentesEnceramento: [12, 11, 21, 22],
  },
  clinico: {
    possuiResina: "sim",
    dentesResina: [11, 21],
    intencao: "ambos",
    alteracaoCor: "indefinido",
    informacoes: "Linha do sorriso alta. Avaliar zênites dos centrais antes do enceramento.",
  },
  comunicacao: { apresentacao: "ambos", periodo: "tarde", entrega: "whatsapp" },
  aceiteTermos: true,
};
