import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <header className="site-header">
        <Link to="/solicitar" aria-label="Quorum Lab — início">
          <BrandMark />
        </Link>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <span>Quorum Lab · Planejamento digital</span>
        <nav aria-label="Documentos legais">
          <Link to="/termos">Termos</Link>
          <Link to="/privacidade">Privacidade</Link>
        </nav>
      </footer>
    </div>
  );
}
