// ÚNICO lugar que decide se uma rota pode ser aberta (padrão RequireRole do GeoEscolas).
// Nenhuma página repete essa checagem.
//  - sem props: só exige sessão e uma organização escolhida;
//  - papelMinimo: nível no conteúdo — papel antigo (membros) ou a permissão equivalente (fase 1B, D-78);
//  - permissao: permissão configurável (catálogo em lib/permissoes), em qualquer escopo; com lista, basta uma.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Papel } from '../lib/tipos';

const NIVEL: Record<Papel, number> = { editor: 1, publicador: 2, admin: 3 };

export function ExigirAcesso({ papelMinimo, permissao }: { papelMinimo?: Papel; permissao?: string | string[] }) {
  const { sessao, carregando, erro, atual, acessos, saiu, pode, nivel, permissoesCarregadas } = useAuth();
  const local = useLocation();

  if (carregando) return <div className="tela-centro" role="status">Carregando…</div>;
  // Sessão expirada: lembra a página para voltar depois do login. "Sair" explícito: não lembra.
  if (!sessao) return <Navigate to="/entrar" replace state={saiu ? undefined : { de: local.pathname }} />;
  if (erro) return <div className="tela-centro"><p role="alert">{erro}</p></div>;
  if (!atual) {
    return acessos.length > 1
      ? <Navigate to="/escolher-prefeitura" replace state={{ de: local.pathname }} />
      : <div className="tela-centro"><p role="alert">Nenhuma organização disponível.</p></div>;
  }
  if (papelMinimo && (nivel ? NIVEL[nivel] : 0) < NIVEL[papelMinimo]) {
    // O nível pode vir das permissões: espera carregar antes de recusar.
    if (!permissoesCarregadas) return <p role="status">Carregando…</p>;
    return <Navigate to="/" replace />;
  }
  if (permissao) {
    if (!permissoesCarregadas) return <p role="status">Carregando…</p>;
    if (![permissao].flat().some(pode)) return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
