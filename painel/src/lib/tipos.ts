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
  /** Equipe SECKE tem acesso de admin em todos (is_plataforma no banco). */
  papel: Papel;
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
