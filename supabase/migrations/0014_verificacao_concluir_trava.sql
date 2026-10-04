-- =============================================================
-- 0014 · Verificação de links: conclusão uma vez só (D-31)
-- No primeiro teste, duas execuções da Edge Function terminaram juntas e as duas
-- gravaram os problemas (434 registros para 217 problemas). Agora a conclusão trava
-- a verificação (FOR UPDATE): a segunda espera a primeira e vê que já está concluída.
-- =============================================================

create or replace function public.verificacao_concluir(p_verificacao uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_problemas int;
begin
  perform 1 from public.verificacoes_links where id = p_verificacao and status = 'processando' for update;
  if not found then
    return coalesce((select problemas from public.verificacoes_links where id = p_verificacao), 0);
  end if;
  if exists (select 1 from public.verificacao_fila where verificacao_id = p_verificacao and not verificado) then
    return -1;  -- ainda há links a conferir
  end if;
  insert into public.verificacao_problemas (verificacao_id, tipo, url, status_http, erro, origem_tabela, origem_id, origem_titulo)
  select p_verificacao,
         case when f.status_http in (404, 410) then 'link_quebrado' else 'pagina_indisponivel' end,
         f.url_original, f.status_http, f.erro, f.origem_tabela, f.origem_id, f.origem_titulo
    from public.verificacao_fila f
   where f.verificacao_id = p_verificacao
     and (f.status_http in (404, 410) or f.status_http >= 500 or (f.status_http is null and f.erro is not null));
  get diagnostics v_problemas = row_count;
  update public.verificacoes_links
     set status = 'concluida', concluido_em = now(), atualizado_em = now(), problemas = v_problemas
   where id = p_verificacao;
  delete from public.verificacao_fila where verificacao_id = p_verificacao;
  return v_problemas;
end $$;

revoke all on function public.verificacao_concluir(uuid) from public, anon, authenticated;
grant execute on function public.verificacao_concluir(uuid) to service_role;
