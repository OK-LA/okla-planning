-- Ajoute un statut actif/inactif aux employés, pour remplacer la suppression définitive
-- par une désactivation (archivage) — évite de perdre l'historique planning/congés/absences
-- d'un salarié parti (problème rencontré avec Sofian/ES04 pendant la migration).
alter table employees add column if not exists active boolean not null default true;
create index if not exists idx_employees_active on employees(active);
