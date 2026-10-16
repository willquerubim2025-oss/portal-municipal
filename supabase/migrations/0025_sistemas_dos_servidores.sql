-- =============================================================
-- 0025 · Sistemas dos servidores: "Meus sistemas" no painel (D-94)
-- sistemas_externos (0003) era só o cadastro de links públicos (portal da transparência,
-- e-SIC, NFS-e...). Agora um sistema pode ser marcado como de uso dos SERVIDORES
-- (publico = 'servidor') e, se quiser, restrito a alguns papéis (sistema_papeis).
-- O painel mostra a cada servidor só os sistemas dele (meus_sistemas). Sem papel marcado,
-- o sistema vale para todos os servidores da organização.
-- Sistemas de servidor não aparecem para o visitante do portal.
-- =============================================================

alter table public.sistemas_externos
  add column publico text not null default 'cidadao' check (publico in ('cidadao', 'servidor'));
comment on column public.sistemas_externos.publico is
  'cidadao: link público (portal, transparência, serviços). servidor: atalho do painel em "Meus sistemas" (D-94).';

create table public.sistema_papeis (
  municipio_id uuid not null references public.municipios on delete cascade,
  sistema_id   uuid not null,
  papel_id     uuid not null,
  primary key (sistema_id, papel_id),
  foreign key (sistema_id, municipio_id) references public.sistemas_externos (id, municipio_id) on delete cascade,
  foreign key (papel_id, municipio_id)   references public.papeis (id, municipio_id) on delete cascade
);
create index on public.sistema_papeis (municipio_id);
alter table public.sistema_papeis enable row level security;
create policy "sistema_papeis: membros leem" on public.sistema_papeis for select to authenticated
  using (public.is_membro(municipio_id) or public.is_plataforma());
create policy "sistema_papeis: admin gerencia" on public.sistema_papeis for all to authenticated
  using (public.is_admin(municipio_id)) with check (public.is_admin(municipio_id));
grant select, insert, update, delete on public.sistema_papeis to authenticated;
grant all on public.sistema_papeis to service_role;

-- O visitante só vê os sistemas públicos ativos; quem trabalha na organização vê todos.
alter policy "sistemas_externos: público lê ativos" on public.sistemas_externos
  using ((ativo and publico = 'cidadao') or public.is_membro(municipio_id));

-- Os sistemas do servidor logado nesta organização: ativos, de servidor, e sem restrição
-- de papel ou com um papel que ele tem (vínculo ativo). Servidor = papel antigo (membros)
-- ou vínculo configurável (usuario_papeis); a equipe da SECKE vê todos.
create or replace function seguranca.meus_sistemas(p_municipio uuid)
returns table (id uuid, nome text, fornecedor text, categoria text, url text, descricao text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.nome, s.fornecedor, s.categoria, s.url, s.descricao
    from public.sistemas_externos s
   where s.municipio_id = p_municipio and s.ativo and s.publico = 'servidor'
     and (
       seguranca.is_plataforma()
       or exists (select 1 from public.membros m
                   where m.municipio_id = p_municipio and m.user_id = (select auth.uid()) and m.ativo
                     and (m.papel = 'admin'
                          or not exists (select 1 from public.sistema_papeis sp where sp.sistema_id = s.id)))
       or exists (select 1 from public.usuario_papeis up
                    join public.papeis pa on pa.id = up.papel_id and pa.ativo
                   where up.municipio_id = p_municipio and up.user_id = (select auth.uid()) and up.ativo
                     and (pa.protegido
                          or not exists (select 1 from public.sistema_papeis sp where sp.sistema_id = s.id)
                          or exists (select 1 from public.sistema_papeis sp where sp.sistema_id = s.id and sp.papel_id = up.papel_id)))
     )
   order by s.nome
$$;
revoke all on function seguranca.meus_sistemas(uuid) from public;
grant execute on function seguranca.meus_sistemas(uuid) to authenticated;

create or replace function public.meus_sistemas(p_municipio uuid)
returns table (id uuid, nome text, fornecedor text, categoria text, url text, descricao text)
language sql stable security invoker
set search_path = ''
as $$ select * from seguranca.meus_sistemas(p_municipio) $$;
revoke all on function public.meus_sistemas(uuid) from public;
grant execute on function public.meus_sistemas(uuid) to authenticated;
