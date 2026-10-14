import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "./styles/tokens.css";
import "./styles/base.css";

import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { SiteFrame } from "./components/SiteFrame";

// Cada rota é um módulo independente. Quando o site institucional existir,
// basta trocar o elemento de "/" — o formulário em /solicitar não muda.
const SolicitarPage = lazy(() => import("./features/solicitar/SolicitarPage"));
const TermosPage = lazy(() => import("./pages/TermosPage"));
const PrivacidadePage = lazy(() => import("./pages/PrivacidadePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Área interna: módulo isolado, com moldura própria e um único ponto para o
// futuro login (src/features/interno/InternoGate.tsx). Não afeta /solicitar.
const InternoLayout = lazy(() => import("./features/interno/InternoLayout"));
const EntregaPage = lazy(() => import("./features/interno/entrega/EntregaPage"));

const routeLoading = <div className="route-loading" aria-hidden="true" />;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <SiteFrame>
              <Suspense fallback={routeLoading}>
                <Outlet />
              </Suspense>
            </SiteFrame>
          }
        >
          <Route path="/" element={<Navigate to="/solicitar" replace />} />
          <Route path="/solicitar" element={<SolicitarPage />} />
          <Route path="/termos" element={<TermosPage />} />
          <Route path="/privacidade" element={<PrivacidadePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route
          path="/interno"
          element={
            <Suspense fallback={routeLoading}>
              <InternoLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="entrega" replace />} />
          <Route path="entrega" element={<EntregaPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
