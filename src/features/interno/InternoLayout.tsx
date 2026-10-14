import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { InternoGate } from "./InternoGate";
import "./interno.css";

/** Moldura das ferramentas internas: independente do site público (/solicitar). */
export default function InternoLayout() {
  return (
    <InternoGate>
      <div className="site interno">
        <header className="interno-header">
          <BrandMark height={34} />
          <span className="micro">Uso interno</span>
        </header>
        <main className="interno-main">
          <Suspense fallback={<div className="route-loading" aria-hidden="true" />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="interno-footer">
          <span>Quorum Lab · Ferramenta interna</span>
          <span>Nada é enviado nem armazenado</span>
        </footer>
      </div>
    </InternoGate>
  );
}
