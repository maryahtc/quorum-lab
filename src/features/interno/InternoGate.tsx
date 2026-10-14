import type { ReactNode } from "react";

/**
 * Ponto único de proteção da área /interno.
 *
 * Nesta versão não há autenticação: o conteúdo é exibido diretamente.
 * Quando o login existir, a verificação entra aqui (redirecionar ou exibir
 * a tela de acesso) — nenhuma ferramenta interna precisa ser alterada.
 */
export function InternoGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
