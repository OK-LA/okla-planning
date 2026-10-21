-- Repos "protégés" par le salarié : un jour de repos prévu qu'il verrouille (rendez-vous important…)
-- et que le gestionnaire ne peut alors plus modifier. Maximum 3 verrous actifs (jour à venir) par
-- salarié, contrôlé côté application. Une ligne = un repos verrouillé. Table dédiée écrite ligne à
-- ligne (jamais via l'écriture groupée du planning) pour qu'un salarié ne puisse pas écraser les
-- verrous d'un autre (Antoine, 2026-10-21).
create table if not exists repos_verrouilles (
  employee_id text not null,
  entry_date  date not null,
  created_at  timestamptz not null default now(),
  primary key (employee_id, entry_date)
);

alter table repos_verrouilles disable row level security;
-- Filet de sécurité si Supabase réactive RLS sur les nouvelles tables (cf. 028_planning_recaps).
drop policy if exists "acces_total" on repos_verrouilles;
create policy "acces_total" on repos_verrouilles for all to anon, authenticated using (true) with check (true);
grant all on repos_verrouilles to anon, authenticated;

NOTIFY pgrst, 'reload schema';
