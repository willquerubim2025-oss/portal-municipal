-- =============================================================
-- 0006 · Busca unificada (RF03) e bucket de mídias
-- =============================================================

-- Busca em notícias/avisos, páginas, documentos e serviços de um município.
-- SECURITY INVOKER: o anon só encontra o que a RLS deixa ver (publicado).
create or replace function public.buscar(
  p_municipio uuid,
  p_termo     text,
  p_limite    int default 20,
  p_offset    int default 0
)
returns table (
  tipo         text,
  id           uuid,
  titulo       text,
  resumo       text,
  caminho      text,
  publicado_em timestamptz,
  relevancia   real
)
language sql stable
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('pg_catalog.portuguese', public.f_unaccent(p_termo)) as tsq
  )
  select * from (
    select p.tipo, p.id, p.titulo, p.resumo, 'noticias/' || p.slug, p.publicado_em, ts_rank(p.busca, q.tsq)
    from public.publicacoes p, q where p.municipio_id = p_municipio and p.busca @@ q.tsq
    union all
    select 'pagina', g.id, g.titulo, g.resumo, g.caminho, g.publicado_em, ts_rank(g.busca, q.tsq)
    from public.paginas g, q where g.municipio_id = p_municipio and g.busca @@ q.tsq
    union all
    select 'documento', d.id, d.titulo, d.ementa, 'documentos/' || d.slug, d.publicado_em, ts_rank(d.busca, q.tsq)
    from public.documentos d, q where d.municipio_id = p_municipio and d.busca @@ q.tsq
    union all
    select 'servico', s.id, s.titulo, s.descricao, 'servicos/' || s.slug, s.publicado_em, ts_rank(s.busca, q.tsq)
    from public.servicos s, q where s.municipio_id = p_municipio and s.busca @@ q.tsq
  ) r
  order by 7 desc, 6 desc nulls last
  limit least(p_limite, 100) offset p_offset
$$;

-- -------------------------------------------------------------
-- Storage: bucket público "midias", pasta raiz = municipio_id
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('midias', 'midias', true)
on conflict (id) do nothing;

create or replace function public.municipio_do_arquivo(p_nome text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return (storage.foldername(p_nome))[1]::uuid;
exception when others then
  return null;
end $$;

-- O visitante baixa pela URL pública do bucket (sem RLS). Esta policy serve ao
-- painel: listar arquivos, e o UPDATE/upsert do Storage também exige SELECT.
create policy "midias: membros listam" on storage.objects for select to authenticated
  using (bucket_id = 'midias' and public.is_membro(public.municipio_do_arquivo(name)));
create policy "midias: membros enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'midias' and public.is_membro(public.municipio_do_arquivo(name)));
-- Substituir o arquivo troca o conteúdo de algo que pode já estar publicado
-- (ex.: PDF de um edital); por isso só publicador/admin (D-09).
create policy "midias: publicador substitui" on storage.objects for update to authenticated
  using (bucket_id = 'midias' and public.pode_publicar(public.municipio_do_arquivo(name)))
  with check (bucket_id = 'midias' and public.pode_publicar(public.municipio_do_arquivo(name)));
create policy "midias: publicador exclui" on storage.objects for delete to authenticated
  using (bucket_id = 'midias' and public.pode_publicar(public.municipio_do_arquivo(name)));
