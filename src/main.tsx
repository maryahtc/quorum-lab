import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "./styles/tokens.css";
import "./styles/base.css";

import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SiteFrame } from "./components/SiteFrame";

// Cada rota é um módulo independente. Quando o site institucional existir,
// basta trocar o elemento de "/" — o formulário em /solicitar não muda.
const SolicitarPage = lazy(() => import("./features/solicitar/SolicitarPage"));
const TermosPage = lazy(() => import("./pages/TermosPage"));
const PrivacidadePage = lazy(() => import("./pages/PrivacidadePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SiteFrame>
        <Suspense fallback={<div className="route-loading" aria-hidden="true" />}>
          <Routes>
            <Route path="/" element={<Navigate to="/solicitar" replace />} />
            <Route path="/solicitar" element={<SolicitarPage />} />
            <Route path="/termos" element={<TermosPage />} />
            <Route path="/privacidade" element={<PrivacidadePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </SiteFrame>
    </BrowserRouter>
  </StrictMode>,
);
