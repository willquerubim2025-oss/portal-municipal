// ÚNICO lugar que decide se uma rota pode ser aberta (padrão RequireRole do GeoEscolas).
// Nenhuma página repete essa checagem.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Papel } from '../lib/tipos';

const NIVEL: Record<Papel, number> = { editor: 1, publicador: 2, admin: 3 };

export function ExigirAcesso({ papelMinimo = 'editor' }: { papelMinimo?: Papel }) {
  const { sessao, carregando, erro, atual, acessos, saiu } = useAuth();
  const local = useLocation();

  if (carregando) return <div className="tela-centro" role="status">Carregando…</div>;
  // Sessão expirada: lembra a página para voltar depois do login. "Sair" explícito: não lembra.
  if (!sessao) return <Navigate to="/entrar" replace state={saiu ? undefined : { de: local.pathname }} />;
  if (erro) return <div className="tela-centro"><p role="alert">{erro}</p></div>;
  if (!atual) {
    return acessos.length > 1
      ? <Navigate to="/escolher-prefeitura" replace state={{ de: local.pathname }} />
      : <div className="tela-centro"><p role="alert">Nenhuma prefeitura disponível.</p></div>;
  }
  if (NIVEL[atual.papel] < NIVEL[papelMinimo]) return <Navigate to="/" replace />;
  return <Outlet />;
}
