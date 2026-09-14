-- Notifications au gestionnaire quand un salarié modifie ses propres coordonnées (téléphone,
-- adresse). Table dédiée (pas un blob JSON) car c'est un flux qui grandit dans le temps et n'a
-- besoin que d'un upsert (jamais de suppression en masse) + une mise à jour ciblée de `seen`.
create table if not exists profil_notifs (
  id          bigint primary key,           -- Date.now() côté client
  emp_id      text not null,
  emp_name    text,
  message     text,
  seen        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table profil_notifs disable row level security;
grant all on profil_notifs to anon, authenticated;
