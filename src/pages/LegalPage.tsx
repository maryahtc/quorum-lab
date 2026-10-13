import { useEffect, type ReactNode } from "react";
import { LEGAL_TEXTS_DRAFT } from "../shared/config";

/**
 * Estrutura comum de /termos e /privacidade.
 * ATENÇÃO: os textos são RASCUNHOS e precisam de revisão jurídica antes do
 * lançamento público. Trechos entre [colchetes] são dados a preencher.
 * Após a revisão, defina LEGAL_TEXTS_DRAFT = false em src/shared/config.ts.
 */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Quorum Lab`;
  }, [title]);
  return (
    <article className="doc-page step">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display">{title}</h1>
      <p className="micro" style={{ marginTop: 20 }}>Versão de {updated}</p>
      {LEGAL_TEXTS_DRAFT && (
        <div className="draft-banner" role="note">
          <strong>Rascunho · em revisão jurídica</strong>
          Este texto é uma versão preliminar, sujeita a revisão jurídica antes do lançamento público do serviço.
        </div>
      )}
      {children}
    </article>
  );
}

export const H = ({ n, children }: { n: number; children: ReactNode }) => (
  <h2><span>{String(n).padStart(2, "0")}</span>{children}</h2>
);

export const Ph = ({ children }: { children: ReactNode }) => <span className="placeholder">[{children}]</span>;
