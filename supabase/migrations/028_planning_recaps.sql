-- Récapitulatif des modifications de planning "envoyées" à un salarié (message qu'il voit en ouvrant
-- son compte). Jusqu'ici la bannière "Planning modifié" vivait uniquement dans le localStorage de
-- l'appareil du gestionnaire (S.mods, jamais synchronisé) : un salarié sur son téléphone ne la
-- voyait jamais. Les modifications restent "en attente" (S.params.pendingSms) tant que le
-- gestionnaire ne les envoie pas ; à l'envoi, elles sont publiées ici, une ligne par modification.
-- Table dédiée (pas un blob JSON) : un flux qui grandit, avec insertion en masse et simple
-- passage de `vu` à true côté salarié — même modèle que profil_notifs (Antoine, 2026-10-09).
create table if not exists planning_recaps (
  id          bigint primary key,           -- Date.now() côté client (unique, croissant)
  emp_id      text not null,
  dl          text not null,                -- date(s) concernée(s), déjà formatée(s)
  det         text not null,                -- détail de la modification
  vu          boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists planning_recaps_emp_vu on planning_recaps (emp_id, vu);

alter table planning_recaps disable row level security;
-- Filet de sécurité : si Supabase réactive RLS sur les nouvelles tables (réglage du projet), la
-- politique ci-dessous garde l'accès ouvert comme sur les autres tables (cf. plan sécurité, phase 4).
drop policy if exists "acces_total" on planning_recaps;
create policy "acces_total" on planning_recaps for all to anon, authenticated using (true) with check (true);
grant all on planning_recaps to anon, authenticated;

NOTIFY pgrst, 'reload schema';
