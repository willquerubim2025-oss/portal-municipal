-- =============================================================
-- 0023 · Pré-visualização de rascunho no portal (D-91)
-- O portal só lê o que está publicado (RLS). Para ver um rascunho com o visual do site,
-- quem pode editar gera um link temporário: criar_previa() devolve um token (uuid aleatório,
-- válido por 30 minutos) e o portal mostra o conteúdo em /previa/<token>, sem cache e sem
-- indexação. Só o token abre o rascunho; a tabela de tokens não é exposta a ninguém.
-- Começa por notícias e avisos (publicacoes), o molde dos demais módulos (D-18).
-- =============================================================

create table public.previas (
  token        uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios on delete cascade,
  tabela       text not null check (tabela in ('publicacoes')),
  registro_id  uuid not null,
  criado_por   uuid default auth.uid() references auth.users on delete set null,
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null default now() + interval '30 minutes'
);
create index on public.previas (expira_em);
alter table public.previas enable row level security;
-- Sem policies e sem grants: só as funções do schema seguranca (SECURITY DEFINER, não exposto)
-- leem e gravam; em public ficam invólucros SECURITY INVOKER de mesma assinatura (padrão da 0016).

-- Gera o link: só quem pode editar o conteúdo daquela organização (is_membro: papel antigo
-- ou conteudo.editar/publicar/organizacao.administrar, 0021). Limpa os tokens vencidos.
create or replace function seguranca.criar_previa(p_tabela text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mid   uuid;
  v_token uuid;
begin
  if p_tabela <> 'publicacoes' then
    raise exception 'Pré-visualização não disponível para %', p_tabela using errcode = '22023';
  end if;
  select municipio_id into v_mid from public.publicacoes where id = p_id;
  if v_mid is null or not (public.is_membro(v_mid) or public.is_plataforma()) then
    raise exception 'Sem permissão para pré-visualizar este conteúdo' using errcode = '42501';
  end if;
  delete from public.previas where expira_em < now();
  insert into public.previas (municipio_id, tabela, registro_id) values (v_mid, p_tabela, p_id)
  returning token into v_token;
  return v_token;
end $$;
revoke all on function seguranca.criar_previa(text, uuid) from public;
grant execute on function seguranca.criar_previa(text, uuid) to authenticated;

-- Lê o rascunho pelo token (o portal chama como anon). Devolve null se o token não existir,
-- tiver vencido ou for de outra organização (o portal passa a organização do domínio).
-- Mesmo formato da consulta noticia() do portal.
create or replace function seguranca.previa_publicacao(p_token uuid, p_municipio uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'slug', p.slug, 'resumo', p.resumo,
    'corpo_html', p.corpo_html, 'status', p.status,
    'publicado_em', coalesce(p.publicado_em, now()), 'atualizado_em', p.atualizado_em,
    'imagem', (select jsonb_build_object('storage_path', m.storage_path, 'texto_alternativo', m.texto_alternativo)
                 from public.midias m where m.id = p.imagem_destaque_id),
    'galeria', coalesce((select jsonb_agg(jsonb_build_object('legenda', pm.legenda, 'ordem', pm.ordem,
                 'midia', jsonb_build_object('storage_path', m.storage_path, 'texto_alternativo', m.texto_alternativo)))
                 from public.publicacao_midias pm join public.midias m on m.id = pm.midia_id
                where pm.publicacao_id = p.id), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('categoria', jsonb_build_object('nome', c.nome, 'slug', c.slug)))
                 from public.publicacao_categorias pc join public.categorias c on c.id = pc.categoria_id
                where pc.publicacao_id = p.id), '[]'::jsonb),
    'orgao', (select jsonb_build_object('nome', o.nome, 'slug', o.slug) from public.orgaos o where o.id = p.orgao_id)
  )
  from public.previas v
  join public.publicacoes p on p.id = v.registro_id
  where v.token = p_token and v.municipio_id = p_municipio and v.tabela = 'publicacoes'
    and v.expira_em > now() and p.municipio_id = p_municipio
$$;
revoke all on function seguranca.previa_publicacao(uuid, uuid) from public;
grant execute on function seguranca.previa_publicacao(uuid, uuid) to anon, authenticated;

-- Invólucros em public (SECURITY INVOKER): é o que o painel e o portal chamam.
create or replace function public.criar_previa(p_tabela text, p_id uuid)
returns uuid
language sql security invoker
set search_path = ''
as $$ select seguranca.criar_previa(p_tabela, p_id) $$;
revoke all on function public.criar_previa(text, uuid) from public;
grant execute on function public.criar_previa(text, uuid) to authenticated;

create or replace function public.previa_publicacao(p_token uuid, p_municipio uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$ select seguranca.previa_publicacao(p_token, p_municipio) $$;
revoke all on function public.previa_publicacao(uuid, uuid) from public;
grant execute on function public.previa_publicacao(uuid, uuid) to anon, authenticated;
