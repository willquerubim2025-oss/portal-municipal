-- =============================================================
-- 0033 · Avaliação do atendimento pelo cidadão (D-136)
-- Bloco "avaliacao" da página inicial: nota de 1 a 5, protocolo e comentário opcionais, sem dado pessoal.
--   avaliacoes            só o admin da organização (e a SECKE) lê; ninguém grava direto na tabela.
--   (As duas funções ficam no schema `seguranca`, SECURITY DEFINER, com uma casca SECURITY INVOKER em
--    `public`, como as demais chamáveis pelo visitante: regra testada em 0016.)
--   registrar_avaliacao   única porta de entrada (visitante anônimo): confere a organização (ativa e com o
--                         bloco "avaliacao" ligado na página inicial), a nota e os tamanhos.
--   resumo_avaliacoes     resumo público dos últimos 12 meses: total, média e quantidade por nota.
-- =============================================================

create table public.avaliacoes (
  id           uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios on delete cascade,
  nota         smallint not null check (nota between 1 and 5),
  protocolo    text check (char_length(protocolo) <= 40),
  comentario   text check (char_length(comentario) <= 1000),
  criado_em    timestamptz not null default now()
);
create index on public.avaliacoes (municipio_id, criado_em desc);
comment on table public.avaliacoes is 'Avaliações do atendimento feitas no portal (D-136). Gravação só por registrar_avaliacao().';

alter table public.avaliacoes enable row level security;
create policy "avaliacoes: admin lê" on public.avaliacoes for select to authenticated
  using (public.is_admin(municipio_id) or public.is_plataforma());
create policy "avaliacoes: admin apaga" on public.avaliacoes for delete to authenticated
  using (public.is_admin(municipio_id) or public.is_plataforma());
grant select, delete on public.avaliacoes to authenticated;
grant all on public.avaliacoes to service_role;

create or replace function seguranca.registrar_avaliacao(p_municipio uuid, p_nota int, p_protocolo text default null, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'Nota inválida' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.municipios m
     where m.id = p_municipio and m.ativo
       and coalesce(m.config -> 'home' -> 'blocos', '[]'::jsonb) ? 'avaliacao'
  ) then
    raise exception 'Avaliação não disponível para esta organização' using errcode = '42501';
  end if;
  insert into public.avaliacoes (municipio_id, nota, protocolo, comentario)
  values (p_municipio, p_nota,
          nullif(left(btrim(coalesce(p_protocolo, '')), 40), ''),
          nullif(left(btrim(coalesce(p_comentario, '')), 1000), ''));
end $$;
revoke all on function seguranca.registrar_avaliacao(uuid, int, text, text) from public;
grant execute on function seguranca.registrar_avaliacao(uuid, int, text, text) to anon, authenticated, service_role;

create or replace function public.registrar_avaliacao(p_municipio uuid, p_nota int, p_protocolo text default null, p_comentario text default null)
returns void
language sql
security invoker
set search_path = ''
as $$ select seguranca.registrar_avaliacao(p_municipio, p_nota, p_protocolo, p_comentario) $$;
revoke all on function public.registrar_avaliacao(uuid, int, text, text) from public;
grant execute on function public.registrar_avaliacao(uuid, int, text, text) to anon, authenticated, service_role;

create or replace function seguranca.resumo_avaliacoes(p_municipio uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'media', round(avg(a.nota)::numeric, 1),
    'dist', jsonb_build_array(
      count(*) filter (where a.nota = 1), count(*) filter (where a.nota = 2), count(*) filter (where a.nota = 3),
      count(*) filter (where a.nota = 4), count(*) filter (where a.nota = 5)))
  from public.avaliacoes a
  where a.municipio_id = p_municipio and a.criado_em > now() - interval '12 months'
$$;
revoke all on function seguranca.resumo_avaliacoes(uuid) from public;
grant execute on function seguranca.resumo_avaliacoes(uuid) to anon, authenticated, service_role;

create or replace function public.resumo_avaliacoes(p_municipio uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select seguranca.resumo_avaliacoes(p_municipio) $$;
revoke all on function public.resumo_avaliacoes(uuid) from public;
grant execute on function public.resumo_avaliacoes(uuid) to anon, authenticated, service_role;
