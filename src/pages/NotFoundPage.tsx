import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="intro step">
      <p className="eyebrow">404</p>
      <h1 className="display">Página não encontrada</h1>
      <p className="lead">
        <Link to="/solicitar" style={{ color: "var(--gold)" }}>Ir para a solicitação de planejamento</Link>
      </p>
    </div>
  );
}
