-- Permet de cibler des participants spécifiques pour une réunion/formation (au lieu de
-- toujours s'adresser à tout le monde). Tableau vide ou absent = tous les employés (comportement
-- actuel préservé pour les événements déjà créés).
alter table internal_events add column if not exists participants jsonb not null default '[]'::jsonb;
