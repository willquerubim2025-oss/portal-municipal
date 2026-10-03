-- =============================================================
-- 0011 · Limpeza do cache do portal ao publicar (D-30)
-- O portal guarda as páginas na borda da Cloudflare por até 10 min, com a etiqueta
-- do município (Cache-Tag: m-<id>). Quando o conteúdo de um município muda, um
-- gatilho o marca como pendente; a cada minuto, uma rotina (pg_cron) pede ao portal
-- a limpeza de todas as etiquetas pendentes numa chamada só (pg_net). Agrupar
-- importa: a Cloudflare permite 5 limpezas por minuto, e uma migração grava milhares
-- de linhas.
-- Tudo fica no schema "interno", que não é exposto pela Data API: nem anon nem
-- authenticated enxergam a fila ou chamam as funções.
-- Configuração por projeto (Vault): portal_cache_url (ex.: https://portal…workers.dev)
-- e portal_cache_segredo (o mesmo CACHE_SEGREDO do Worker). Sem eles, a rotina não faz nada.
-- =============================================================

create schema if not exists interno;
revoke all on schema interno from public, anon, authenticated;

create table interno.cache_pendente (
  municipio_id uuid primary key references public.municipios on delete cascade,
  desde        timestamptz not null default now()
);
alter table interno.cache_pendente enable row level security;

-- Município da linha alterada. Tabelas sem municipio_id herdam do registro pai.
create or replace function interno.marcar_cache_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_mid   uuid;
begin
  v_mid := case tg_table_name
    when 'municipios'            then (v_linha->>'id')::uuid
    when 'documento_arquivos'    then (select d.municipio_id from public.documentos d where d.id = (v_linha->>'documento_id')::uuid)
    when 'publicacao_categorias' then (select p.municipio_id from public.publicacoes p where p.id = (v_linha->>'publicacao_id')::uuid)
    else (v_linha->>'municipio_id')::uuid
  end;
  if v_mid is not null then
    insert into interno.cache_pendente (municipio_id) values (v_mid) on conflict do nothing;
  end if;
  return null;
end $$;

-- Tudo o que o portal mostra. Redirecionamentos: só quando muda o destino (o contador
-- de acessos é atualizado a cada visita e não pode disparar limpeza).
do $$
declare t text;
begin
  foreach t in array array[
    'municipios', 'municipio_dominios', 'categorias', 'publicacoes', 'publicacao_categorias',
    'publicacao_midias', 'documentos', 'documento_arquivos', 'documento_relacoes', 'paginas',
    'servicos', 'eventos', 'perguntas_frequentes', 'destaques', 'menus', 'menu_itens', 'orgaos',
    'transparencia_secoes', 'transparencia_itens', 'sistemas_externos', 'midias'
  ] loop
    execute format(
      'create trigger trg_%1$s_cache after insert or update or delete on public.%1$I
         for each row execute function interno.marcar_cache_pendente()', t);
  end loop;
end $$;
create trigger trg_redirecionamentos_cache
  after insert or delete or update of origem, destino, codigo on public.redirecionamentos
  for each row execute function interno.marcar_cache_pendente();

-- Envia a limpeza dos pendentes. A fila é esvaziada no envio; se a chamada falhar,
-- a validade de 10 min do cache garante que o conteúdo novo apareça mesmo assim.
create or replace function interno.limpar_cache_portal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url     text;
  v_segredo text;
  v_tags    jsonb;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'portal_cache_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'portal_cache_segredo';
  if v_url is null or v_segredo is null then return; end if;

  with apagados as (delete from interno.cache_pendente returning municipio_id)
  select jsonb_agg('m-' || municipio_id) into v_tags from apagados;
  if v_tags is null then return; end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/__cache/limpar',
    body := jsonb_build_object('tags', v_tags),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_segredo),
    timeout_milliseconds := 10000
  );
end $$;

revoke all on all functions in schema interno from public, anon, authenticated;

-- Agendamento só onde há pg_cron e pg_net (no Supabase; o teste local não tem).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    create extension if not exists pg_cron;
    perform cron.schedule('limpar-cache-portal', '* * * * *', 'select interno.limpar_cache_portal()');
  end if;
end $$;
