-- =============================================================
-- 0009 · Permissões do service_role (complementa 0008, D-13)
-- service_role ignora o RLS, mas ainda precisa de GRANT. Com a exposição
-- automática desligada, as tabelas criadas pelo postgres não lhe dão
-- SELECT/INSERT/UPDATE/DELETE. Ele é usado só no servidor: Edge Functions
-- (links, exportação, convite de usuários), migração do WordPress e backup.
-- =============================================================

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
