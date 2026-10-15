// Registro central das permissões (D-38, regra 1 da especificação: "toda funcionalidade nasce com um código").
// O catálogo fica em permissoes.catalogo.json: o painel o lê para montar o menu, e o script
// `npm run permissoes:sincronizar` o envia ao banco (public.sincronizar_permissoes, só com a chave de serviço).
// Permissão nova nasce desligada para todos os papéis; o Administrador a liga no painel.
// Quem garante a regra é o banco (RLS com public.pode); aqui é só para a interface não oferecer o que vai falhar.
import catalogo from './permissoes.catalogo.json';

export type Escopo = 'rede' | 'regiao' | 'unidade' | 'proprio';
export interface Permissao { codigo: string; modulo: string; nome: string; descricao: string; escopos: Escopo[]; ordem: number }

export const CATALOGO = catalogo as Permissao[];
export type CodigoPermissao = (typeof catalogo)[number]['codigo'];

export const ROTULO_ESCOPO: Record<Escopo, string> = {
  rede: 'Toda a rede',
  regiao: 'Só a região do vínculo',
  unidade: 'Só a unidade do vínculo',
  proprio: 'Só o que a pessoa criou',
};

/** Permissões que o Administrador nunca perde (seguranca.essenciais_admin, 0018). */
export const ESSENCIAIS_ADMIN = ['permissoes.gerenciar', 'usuarios.vincular'];

/** Linha de public.minhas_permissoes(): o que o usuário logado pode, com escopo e alvo. */
export interface MinhaPermissao { permissao: string; escopo: Escopo; unidade_id: string | null; regiao_id: string | null }
