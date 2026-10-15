export type Papel = 'admin' | 'publicador' | 'editor';
export type Status = 'rascunho' | 'publicado' | 'despublicado';

export interface MunicipioResumo {
  id: string;
  nome: string;
  slug: string;
  uf: string;
}

/** Município que o usuário pode editar e o papel dele nesse município. */
export interface Acesso {
  municipio: MunicipioResumo;
  /** Papel antigo (membros: admin/publicador/editor). null = só papéis configuráveis (usuario_papeis, D-38).
   *  Equipe SECKE tem acesso de admin em todos (is_plataforma no banco). */
  papel: Papel | null;
  /** Nomes dos papéis configuráveis da pessoa nesta organização (D-38). */
  papeis: string[];
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  publicador: 'Publicador',
  editor: 'Editor',
};

export const ROTULO_STATUS: Record<Status, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  despublicado: 'Despublicado',
};
