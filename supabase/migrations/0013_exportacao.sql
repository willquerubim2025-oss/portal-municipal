-- =============================================================
-- 0013 · Exportação completa por município (RF19, D-32)
-- O admin pede no painel; a Edge Function exportar gera um ZIP com todos os dados
-- do município em formato aberto (JSON e CSV) e a lista dos arquivos com o endereço
-- de cada um, e guarda no bucket privado "exportacoes" (pasta = municipio_id).
-- O admin baixa por link assinado. Disparo: interno.disparar_rotinas (0012).
-- =============================================================

insert into storage.buckets (id, name, public)
values ('exportacoes', 'exportacoes', false)
on conflict (id) do nothing;

-- Só o admin do município (ou a SECKE) lê o que está na pasta do município.
-- Ninguém grava pela API: quem grava é a Edge Function, com a chave de serviço.
create policy "exportacoes: admin baixa" on storage.objects for select to authenticated
  using (bucket_id = 'exportacoes'
         and (public.is_admin(public.municipio_do_arquivo(name)) or public.is_plataforma()));

-- Uma exportação em andamento por município.
create unique index exportacoes_uma_em_andamento on public.exportacoes (municipio_id)
  where status in ('pendente', 'processando');
alter table public.exportacoes add column atualizado_em timestamptz not null default now();

-- O disparador passa a chamar também a exportação.
create or replace function interno.disparar_rotinas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_url text := (select valor from interno.configuracao where chave = 'supabase_url');
begin
  if v_url is null then return; end if;
  -- Verificação em andamento: a função retoma de onde parou. Sem batimento por 30 min
  -- (falha repetida): desiste; a verificação semanal seguinte tenta de novo.
  update public.verificacoes_links set status = 'erro', erro = 'interrompida sem batimento por 30 min'
   where status = 'processando' and atualizado_em < now() - interval '30 minutes';
  if exists (select 1 from public.verificacoes_links where status in ('pendente', 'processando')) then
    perform net.http_post(url := v_url || '/functions/v1/verificar-links', body := '{}'::jsonb,
                          headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 1000);
  end if;

  -- Exportação parada há 15 min (a função leva poucos minutos): volta para a fila uma vez;
  -- se já foi retomada, vira erro (o admin pode pedir de novo).
  update public.exportacoes
     set status = case when erro is null then 'pendente' else 'erro' end,
         erro = coalesce(erro, 'retomada após interrupção'), atualizado_em = now()
   where status = 'processando' and atualizado_em < now() - interval '15 minutes';
  if exists (select 1 from public.exportacoes where status = 'pendente') then
    perform net.http_post(url := v_url || '/functions/v1/exportar', body := '{}'::jsonb,
                          headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 1000);
  end if;
end $$;

revoke all on all functions in schema interno from public, anon, authenticated;
