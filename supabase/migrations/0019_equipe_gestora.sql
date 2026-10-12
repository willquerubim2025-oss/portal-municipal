-- =============================================================
-- 0019 · Equipe gestora, supervisor da unidade e busca de unidade (fase 1A)
-- Equipe em três níveis (1 dirigentes · 2 supervisores · 3 diretores de
-- divisão), com a divisão apontando para o organograma (orgaos).
-- Foto só com autorização de uso de imagem (ECA/LGPD): regra no banco.
-- O portal mostra só quem está visível; a seção inteira some com
-- config.modulos.equipe_gestora = false.
-- =============================================================

create table public.equipe (
  id                 uuid primary key default gen_random_uuid(),
  municipio_id       uuid not null references public.municipios on delete cascade,
  nome               text not null,
  cargo              text not null,
  nivel              smallint not null check (nivel between 1 and 3),
  orgao_id           uuid,                          -- divisão/departamento no organograma
  foto_id            uuid,
  autorizacao_imagem boolean not null default false,
  email              text,                          -- contato institucional
  telefone           text,
  resumo             text,
  ordem              int not null default 0,
  visivel            boolean not null default false, -- só aparece no portal quando autorizado
  dados_confirmados  boolean not null default false, -- false = pendente de confirmação (não inventar dados oficiais)
  user_id            uuid references auth.users on delete set null,
  criado_por         uuid default auth.uid() references auth.users on delete set null,
  atualizado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  unique (id, municipio_id),
  foreign key (orgao_id, municipio_id) references public.orgaos (id, municipio_id) on delete set null (orgao_id),
  foreign key (foto_id, municipio_id)  references public.midias (id, municipio_id) on delete set null (foto_id),
  check (foto_id is null or autorizacao_imagem)
);
create index on public.equipe (municipio_id, nivel, ordem);

-- Supervisor responsável pela unidade (um por unidade).
alter table public.unidades add column supervisor_id uuid,
  add foreign key (supervisor_id, municipio_id) references public.equipe (id, municipio_id) on delete set null (supervisor_id);
create index on public.unidades (supervisor_id) where supervisor_id is not null;

-- O supervisor é decisão da rede, não do diretor (amplia 0018).
create or replace function seguranca.checar_campos_unidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not seguranca.pode(old.municipio_id, 'unidades.gerenciar')
     and (new.municipio_id, new.regiao_id, new.ativo, new.tipo, new.slug, new.codigo_inep, new.conveniada, new.ordem, new.supervisor_id)
         is distinct from
         (old.municipio_id, old.regiao_id, old.ativo, old.tipo, old.slug, old.codigo_inep, old.conveniada, old.ordem, old.supervisor_id) then
    raise exception 'Somente quem gerencia as unidades altera região, supervisor, situação, tipo, INEP e ordem' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  execute 'create trigger trg_equipe_atualizado before update on public.equipe
             for each row execute function public.set_atualizado_em()';
  execute 'create trigger trg_equipe_atualizado_por before update on public.equipe
             for each row execute function public.set_atualizado_por()';
  execute 'create trigger trg_equipe_auditoria after insert or update or delete on public.equipe
             for each row execute function public.registrar_auditoria()';
  execute 'create trigger trg_equipe_cache after insert or update or delete on public.equipe
             for each row execute function interno.marcar_cache_pendente()';
end $$;

alter table public.equipe enable row level security;

create policy "equipe: público lê os visíveis" on public.equipe for select to anon, authenticated
  using (
    (visivel and coalesce((select (m.config->'modulos'->>'equipe_gestora')::boolean
                             from public.municipios m where m.id = equipe.municipio_id), true))
    or public.is_membro(municipio_id) or public.pode(municipio_id, 'equipe.gerenciar')
  );
create policy "equipe: gestor gerencia" on public.equipe for all to authenticated
  using (public.pode(municipio_id, 'equipe.gerenciar'))
  with check (public.pode(municipio_id, 'equipe.gerenciar'));

grant select on public.equipe to anon;
grant select, insert, update, delete on public.equipe to authenticated;
grant all on public.equipe to service_role;

-- -------------------------------------------------------------
-- Busca de unidade por nome, sigla ou bairro (card "Fale com o supervisor")
-- SECURITY INVOKER: o supervisor só vem se estiver visível ao visitante.
-- -------------------------------------------------------------
create or replace function public.buscar_unidade(p_municipio uuid, p_termo text, p_limite int default 10)
returns table (
  id uuid, nome text, sigla text, tipo text, bairro text, endereco text, telefone text, email text,
  supervisor_nome text, supervisor_cargo text, supervisor_email text, supervisor_telefone text
)
language sql stable security invoker
set search_path = ''
as $$
  with q as (select '%' || public.f_unaccent(lower(trim(p_termo))) || '%' as t)
  select u.id, u.nome, u.sigla, u.tipo, u.bairro, u.endereco, u.telefone, u.email,
         e.nome, e.cargo, e.email, e.telefone
    from public.unidades u
    cross join q
    left join public.equipe e on e.id = u.supervisor_id
   where u.municipio_id = p_municipio and u.ativo and length(trim(p_termo)) >= 2
     and (public.f_unaccent(lower(u.nome)) like q.t
          or public.f_unaccent(lower(coalesce(u.sigla, ''))) like q.t
          or public.f_unaccent(lower(coalesce(u.bairro, ''))) like q.t)
   order by (public.f_unaccent(lower(u.nome)) like q.t) desc, u.nome
   limit least(p_limite, 50)
$$;
revoke all on function public.buscar_unidade(uuid, text, int) from public;
grant execute on function public.buscar_unidade(uuid, text, int) to anon, authenticated, service_role;

-- -------------------------------------------------------------
-- Mídias públicas: também foto de unidade ativa e de membro visível e autorizado (amplia 0016).
-- -------------------------------------------------------------
create or replace function seguranca.midia_publica(p_midia uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.publicacoes p
                 where p.imagem_destaque_id = p_midia and p.status = 'publicado' and p.publicado_em <= now())
      or exists (select 1 from public.publicacao_midias pm join public.publicacoes p on p.id = pm.publicacao_id
                 where pm.midia_id = p_midia and p.status = 'publicado' and p.publicado_em <= now())
      or exists (select 1 from public.destaques d
                 where d.imagem_id = p_midia and d.status = 'publicado' and d.publicado_em <= now())
      or exists (select 1 from public.eventos e
                 where e.imagem_id = p_midia and e.status = 'publicado' and e.publicado_em <= now())
      or exists (select 1 from public.orgaos o
                 where o.responsavel_foto_id = p_midia and o.ativo)
      or exists (select 1 from public.documento_arquivos a join public.documentos d on d.id = a.documento_id
                 where a.midia_id = p_midia and d.status = 'publicado' and d.publicado_em <= now())
      or exists (select 1 from public.unidades u where u.foto_id = p_midia and u.ativo)
      or exists (select 1 from public.equipe q where q.foto_id = p_midia and q.visivel and q.autorizacao_imagem)
$$;

create index if not exists unidades_foto_idx on public.unidades (foto_id) where foto_id is not null;
create index if not exists equipe_foto_idx   on public.equipe (foto_id) where foto_id is not null;
