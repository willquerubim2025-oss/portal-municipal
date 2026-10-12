-- =============================================================
-- 0017 · A linha de "municipios" é a organização contratante (tenant)
-- Decisão de 12/10/2026 (opção A): cada portal é uma organização isolada,
-- seja a prefeitura inteira, uma secretaria (ex.: SMEDU de Paulínia), uma
-- câmara ou uma autarquia. Duas organizações da mesma cidade NÃO
-- compartilham dados: o isolamento continua por municipio_id, com as
-- mesmas policies, FKs compostas e pastas do Storage.
-- O nome "municipio_id" fica por compatibilidade; dentro de cada
-- organização, "orgaos" continua sendo o organograma.
-- =============================================================

comment on table public.municipios is
  'Organização contratante (tenant): prefeitura, secretaria, câmara, autarquia... '
  'Todo dado com municipio_id pertence a uma organização e é isolado das demais por RLS.';

alter table public.municipios
  add column tipo_ente   text not null default 'prefeitura'
                         check (tipo_ente in ('prefeitura', 'secretaria', 'camara', 'autarquia',
                                              'fundacao', 'consorcio', 'outro')),
  add column cidade      text,
  add column codigo_ibge char(7) check (codigo_ibge ~ '^[0-9]{7}$');

comment on column public.municipios.nome is 'Nome oficial da organização (ex.: Secretaria Municipal de Educação de Paulínia).';
comment on column public.municipios.tipo_ente is 'Tipo de organização; orienta o pacote padrão e os textos do portal.';
comment on column public.municipios.cidade is 'Município onde a organização atua (agrupamento e exibição; não dá acesso a nada).';
comment on column public.municipios.codigo_ibge is 'Código IBGE do município (7 dígitos).';

create index on public.municipios (codigo_ibge) where codigo_ibge is not null;

-- Identidade oficial também é da SECKE (amplia 0010, D-20): o admin da
-- organização continua alterando só tema e config.
create or replace function public.checar_campos_municipio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_plataforma()
     and (new.nome, new.slug, new.uf, new.cnpj, new.ativo, new.tipo_ente, new.cidade, new.codigo_ibge)
         is distinct from
         (old.nome, old.slug, old.uf, old.cnpj, old.ativo, old.tipo_ente, old.cidade, old.codigo_ibge) then
    raise exception 'Somente a SECKE altera nome, endereço, UF, CNPJ, tipo, cidade e situação da organização'
      using errcode = '42501';
  end if;
  return new;
end $$;
