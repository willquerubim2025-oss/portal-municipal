-- =============================================================
-- 0010 · O admin do município só altera tema e config (D-20)
-- A policy "municipios: admin edita o seu" (0005) libera o UPDATE da linha
-- inteira. Nome oficial, slug, UF, CNPJ e ativo (tirar o portal do ar)
-- são da SECKE. A policy não enxerga o valor antigo; por isso, trigger.
-- =============================================================

create or replace function public.checar_campos_municipio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_plataforma()
     and (new.nome, new.slug, new.uf, new.cnpj, new.ativo) is distinct from (old.nome, old.slug, old.uf, old.cnpj, old.ativo) then
    raise exception 'Somente a SECKE altera nome, endereço, UF, CNPJ e situação do município'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trg_municipios_campos_admin before update on public.municipios
  for each row execute function public.checar_campos_municipio();
