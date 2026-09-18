-- Demandes de récupération d'heures (type 'recup' dans requests) : nombre d'heures demandées,
-- distinct de jours_ouvres (qui compte des jours, pas des heures) pour éviter toute confusion
-- entre les deux unités (Antoine, 2026-09-18).
alter table requests add column if not exists heures_demandees numeric(5,1);

NOTIFY pgrst, 'reload schema';
