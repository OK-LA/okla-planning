-- Liste des types de contrat personnalisables (en plus de "CDI", toujours fixe) — même principe
-- que motifs_absence.
alter table app_settings add column if not exists types_contrat jsonb not null default '[]'::jsonb;
