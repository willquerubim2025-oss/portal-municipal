-- =============================================================
-- 0020 · Página inicial: avisos, carrossel, manchete e cards de serviço (fase 1A)
-- Só colunas novas em tabelas existentes; regras de acesso inalteradas.
--   destaques    banner = slide do carrossel; alerta urgente = modal; alerta
--                informativo/atenção = faixa. O fim automático já é fim_em.
--                "Uma vez por visitante": o navegador guarda id + versao; editar
--                o aviso sobe a versão e ele volta a aparecer.
--   publicacoes  prioridade 'principal' = manchete maior na grade de notícias.
--   servicos     cards da Área de Serviços, com "em breve" e ligação ao sistema
--                satélite (sistemas_externos) quando ele existir.
-- =============================================================

alter table public.destaques
  add column botao_rotulo  text,
  add column frequencia    text not null default 'uma_vez' check (frequencia in ('uma_vez', 'por_sessao', 'sempre')),
  add column versao        int not null default 1,
  add column publicacao_id uuid,
  add foreign key (publicacao_id, municipio_id) references public.publicacoes (id, municipio_id) on delete set null (publicacao_id);
create index on public.destaques (publicacao_id) where publicacao_id is not null;

create or replace function public.versionar_destaque()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.titulo, new.texto, new.url, new.nivel, new.tipo, new.botao_rotulo, new.imagem_id)
     is distinct from (old.titulo, old.texto, old.url, old.nivel, old.tipo, old.botao_rotulo, old.imagem_id) then
    new.versao := old.versao + 1;
  end if;
  return new;
end $$;
create trigger trg_destaques_versao before update on public.destaques
  for each row execute function public.versionar_destaque();

alter table public.publicacoes
  add column prioridade text not null default 'secundaria' check (prioridade in ('principal', 'secundaria'));
create index on public.publicacoes (municipio_id, prioridade, publicado_em desc) where status = 'publicado';

alter table public.servicos
  add column icone     text,
  add column ordem     int not null default 0,
  add column na_home   boolean not null default false,
  add column em_breve  boolean not null default false,
  add column sistema_id uuid,
  add foreign key (sistema_id, municipio_id) references public.sistemas_externos (id, municipio_id) on delete set null (sistema_id);
create index on public.servicos (municipio_id, ordem) where na_home;
