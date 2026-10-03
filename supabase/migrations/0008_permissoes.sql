-- =============================================================
-- 0008 · Permissões explícitas (D-13)
-- O projeto foi criado com "Automatically expose new tables" desligado:
-- nenhuma tabela ou função nova fica acessível a anon/authenticated sem
-- GRANT. O RLS continua decidindo QUAIS linhas; os GRANTs abaixo decidem
-- QUAIS operações existem para cada papel (defesa em profundidade).
-- Toda tabela ou função nova precisa entrar aqui (ou numa migration nova
-- de permissões) — sem isso a funcionalidade falha fechada.
-- =============================================================

-- Ponto de partida limpo: nada de TRUNCATE/REFERENCES/TRIGGER herdados por padrão.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- -------------------------------------------------------------
-- Visitante (anon): só leitura do que o portal público mostra.
-- -------------------------------------------------------------
grant select on
  public.municipios, public.municipio_dominios,
  public.categorias, public.midias,
  public.publicacoes, public.publicacao_categorias, public.publicacao_midias,
  public.paginas, public.documentos, public.documento_arquivos, public.documento_relacoes,
  public.servicos, public.menus, public.menu_itens,
  public.orgaos, public.perguntas_frequentes, public.eventos, public.destaques,
  public.sistemas_externos, public.transparencia_secoes, public.transparencia_itens,
  public.pntp_criterios, public.redirecionamentos
to anon;

-- -------------------------------------------------------------
-- Usuário logado (painel): CRUD onde o RLS tem policy de escrita.
-- -------------------------------------------------------------
grant select, insert, update, delete on
  public.municipios, public.municipio_dominios, public.perfis, public.membros,
  public.categorias, public.midias,
  public.publicacoes, public.publicacao_categorias, public.publicacao_midias,
  public.paginas, public.documentos, public.documento_arquivos, public.documento_relacoes,
  public.servicos, public.menus, public.menu_itens,
  public.orgaos, public.perguntas_frequentes, public.eventos, public.destaques,
  public.sistemas_externos, public.transparencia_secoes, public.transparencia_itens,
  public.pntp_criterios, public.pntp_atendimento, public.redirecionamentos,
  public.contratos, public.chamados
to authenticated;

-- Só leitura ou só inclusão: o resto é feito por trigger, Edge Function (service_role) ou SECKE.
grant select on
  public.equipe_plataforma, public.auditoria,
  public.verificacoes_links, public.verificacao_problemas,
  public.saldo_solicitacoes, public.relatorio_mensal_chamados
to authenticated;
grant select, insert on public.exportacoes, public.chamado_mensagens to authenticated;

-- Colunas identity (protocolo de chamado, id de mensagem).
grant usage on all sequences in schema public to authenticated;

-- -------------------------------------------------------------
-- Funções. As policies executam com o papel de quem consulta, então
-- as funções de autorização precisam de EXECUTE também para anon.
-- -------------------------------------------------------------
grant execute on function
  public.f_unaccent(text), public.html_para_texto(text), public.tsv_pt("char", text),
  public.is_plataforma(), public.tem_papel(uuid, public.papel_usuario[]),
  public.is_membro(uuid), public.pode_publicar(uuid), public.is_admin(uuid),
  public.municipio_por_dominio(text), public.municipio_do_arquivo(text),
  public.buscar(uuid, text, int, int),
  public.registrar_acesso_redirecionamento(uuid)
to anon, authenticated;

-- Painel: provisionamento (as próprias funções conferem SECKE/admin).
grant execute on function
  public.provisionar_municipio(uuid),
  public.criar_municipio(text, text, char, text)
to authenticated;

-- Funções de trigger não precisam de EXECUTE para disparar; ficam sem grant
-- (e, retornando trigger, não aparecem como RPC na Data API).
