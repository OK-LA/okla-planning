-- OK-LA Planning — migration 001 : schéma relationnel
-- Remplace la table unique okla_store(section, data JSONB) par des tables dédiées.
-- Ce script ne fait QUE créer les nouvelles tables : il ne touche pas à okla_store,
-- ne supprime rien, et peut être exécuté sur le projet Supabase en production sans risque.
--
-- Ordre des créations : respecte les dépendances de clés étrangères.
-- RLS désactivé partout, comme sur okla_store aujourd'hui (pas d'authentification
-- serveur pour l'instant — c'est la priorité 3 du projet, traitée séparément).

-- ══════════════════════════════════════════════════════════════
-- EMPLOYEES
-- ══════════════════════════════════════════════════════════════
create table if not exists employees (
  id                    text primary key,        -- ex. 'E01', généré côté JS, conservé tel quel
  code                  text not null,            -- code de connexion, PAS unique (comportement actuel : Array.find prend le 1er)
  name                  text not null,
  email                 text,
  tel                   text,
  addr                  text,
  site                  text not null,
  slot                  text,                     -- type de créneau par défaut
  has_children          boolean not null default false,
  enfants               jsonb not null default '[]',   -- [{dateNaissance}] — champ unique, jamais interrogé isolément
  contrat_type          text,                     -- 'cdi' | 'cdd' | 'apprentissage' | 'autre' | ''
  date_fin              date,                     -- fin de contrat
  solde_cp_manuel       numeric(5,1),
  solde_cp_manuel_date  date,
  repos_fixe_weekday    smallint,                 -- 0..6 (Date.getDay()), remplace params.reposFixe[empId]
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_employees_site on employees(site);
create index if not exists idx_employees_code on employees(code);

-- ══════════════════════════════════════════════════════════════
-- PLANNING
-- ══════════════════════════════════════════════════════════════
create table if not exists planning_entries (
  employee_id  text not null references employees(id) on delete cascade,
  entry_date   date not null,
  type         text not null,       -- 'magasin' | 'entrepotA' | 'entrepotB' | 'remplacement' | 'vip' | 'conge' | 'maladie' | 'repos' | ...
  site         text,
  note         text,
  updated_at   timestamptz not null default now(),
  primary key (employee_id, entry_date)
);
create index if not exists idx_planning_date on planning_entries(entry_date);

-- ══════════════════════════════════════════════════════════════
-- REQUESTS (congé / congé sans solde / échange / autres demandes)
-- ══════════════════════════════════════════════════════════════
create table if not exists requests (
  id           bigint primary key,          -- valeur Date.now() générée côté JS, conservée telle quelle
  type         text not null,               -- 'conge' | 'conge_sans_solde' | 'echange' | ...
  status       text not null,               -- 'pending' | 'pending_collegue' | 'pending_gestionnaire' | 'approved' | 'refused'
  emp_id       text not null references employees(id),
  emp_name     text,
  emp_email    text,
  date_debut   date,
  date_fin     date,
  date_a       date,                        -- échange uniquement
  date_b       date,                        -- échange uniquement
  cible_id     text references employees(id),   -- collègue ciblé par un échange
  cible_name   text,
  cible_email  text,
  jours_ouvres numeric(4,1),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_requests_emp on requests(emp_id);
create index if not exists idx_requests_status on requests(status);

-- ══════════════════════════════════════════════════════════════
-- ABSENCES
-- ══════════════════════════════════════════════════════════════
create table if not exists absences (
  id          bigint primary key,           -- valeur Date.now()
  emp_id      text not null references employees(id),
  emp_name    text,
  emp_site    text,
  emp_tel     text,
  date_str    date not null,
  motif       text,
  note        text,
  resolved    boolean not null default false,
  remp_id     text references employees(id),
  remp_name   text,
  source      text,                          -- 'gestionnaire' | 'salarie'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_absences_emp on absences(emp_id);
create index if not exists idx_absences_resolved on absences(resolved);

-- ══════════════════════════════════════════════════════════════
-- EVENT TYPES / EVENTS (pastilles colorées, plages d'événements)
-- ══════════════════════════════════════════════════════════════
create table if not exists event_types (
  id           text primary key,             -- ex. 'ferie', 'soldes', ou 'ev_<timestamp>'
  label        text not null,
  color        text not null,
  is_vacances  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists events (
  id          bigint primary key,            -- valeur Date.now()
  type_id     text not null references event_types(id) on delete cascade,
  date_debut  date not null,
  date_fin    date not null,
  portee      text not null,                 -- 'tous' | 'magasin' | 'employe'
  cible       text,                          -- nom de site OU id employé selon `portee` — polymorphe, pas de FK
  created_at  timestamptz not null default now()
);
create index if not exists idx_events_daterange on events(date_debut, date_fin);

-- ══════════════════════════════════════════════════════════════
-- COMMUNICATION INTERNE (evInternes)
-- ══════════════════════════════════════════════════════════════
create table if not exists internal_events (
  id          bigint primary key,            -- valeur Date.now()
  type        text not null,                 -- 'reunion' | 'formation' | 'livraison' | 'autre'
  event_date  date not null,
  label       text,
  created_at  timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- SITE SETTINGS (remplace SC + params.minStaff + params.adresses + params.rotationSamedis)
-- ══════════════════════════════════════════════════════════════
create table if not exists site_settings (
  site                   text primary key,     -- 'Ham', 'Longueau', 'Roye', 'Breteuil', 'Entrepôt'
  color                  text not null,
  bg                     text not null,
  border                 text not null,
  min_staff              int not null default 1,
  adresse                text,
  rotation_samedis_weeks int not null default 2,
  updated_at             timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- APP SETTINGS (ligne unique — résidu vraiment global de params)
-- ══════════════════════════════════════════════════════════════
create table if not exists app_settings (
  id                         boolean primary key default true check (id),  -- force une seule ligne
  verrou                     boolean not null default false,
  type_colors                jsonb not null default '{}',
  motifs_absence             jsonb not null default '[]',    -- [{id,label}]
  regles_enfant_malade       jsonb not null default '{}',    -- {seuils:[...], joursSiMoinsUnAn}
  samedis_pleins             jsonb not null default '{}',    -- exceptions date -> bool
  regles_conges_quota        int not null default 25,
  sam_speciaux               jsonb not null default '{"premiers":true,"soldes":true}',
  updated_at                 timestamptz not null default now()
);
insert into app_settings (id) values (true) on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════
-- JOKERS CONGÉS (params.jokers[empId])
-- ══════════════════════════════════════════════════════════════
create table if not exists employee_leave_jokers (
  employee_id  text not null references employees(id) on delete cascade,
  periode_key  text not null,                 -- année de référence, ex. '2026'
  count        int not null default 0,
  primary key (employee_id, periode_key)
);

-- ══════════════════════════════════════════════════════════════
-- MUR SOCIAL
-- ══════════════════════════════════════════════════════════════
create table if not exists mur_posts (
  id          text primary key,               -- Date.now().toString()
  auteur_id   text,                           -- id employé réel OU littéralement 'mgr' — pas de FK, volontaire
  auteur_nom  text,
  auteur_role text,                           -- 'gestionnaire' | 'salarie'
  texte       text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

create table if not exists mur_post_reactions (
  post_id      text not null references mur_posts(id) on delete cascade,
  emoji        text not null,
  employee_id  text not null,                 -- id employé réel OU 'mgr' — pas de FK, même raison
  primary key (post_id, emoji, employee_id)
);

create table if not exists mur_post_comments (
  id          text primary key,               -- Date.now().toString()
  post_id     text not null references mur_posts(id) on delete cascade,
  auteur_id   text,
  auteur_nom  text,
  texte       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_comments_post on mur_post_comments(post_id);

-- ══════════════════════════════════════════════════════════════
-- RLS : désactivé partout (comme okla_store aujourd'hui), GRANT ALL à anon+authenticated
-- ══════════════════════════════════════════════════════════════
alter table employees disable row level security;
alter table planning_entries disable row level security;
alter table requests disable row level security;
alter table absences disable row level security;
alter table event_types disable row level security;
alter table events disable row level security;
alter table internal_events disable row level security;
alter table site_settings disable row level security;
alter table app_settings disable row level security;
alter table employee_leave_jokers disable row level security;
alter table mur_posts disable row level security;
alter table mur_post_reactions disable row level security;
alter table mur_post_comments disable row level security;

grant all on employees, planning_entries, requests, absences, event_types, events,
  internal_events, site_settings, app_settings, employee_leave_jokers,
  mur_posts, mur_post_reactions, mur_post_comments
  to anon, authenticated;
