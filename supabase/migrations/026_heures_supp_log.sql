-- Journal des ajustements manuels du compteur d'heures (heures_supp), fait à la fiche employé.
-- Alimente l'historique "heures données" (à côté des heures "prises" via une demande de
-- récupération validée, déjà dans la table requests) — voir getHistoriqueRecup() côté client.
-- Ne démarre qu'à partir de maintenant : les ajustements faits avant cette migration ne sont pas
-- reconstitués rétroactivement, seul le solde actuel (employees.heures_supp) en garde la trace
-- (Antoine, 2026-09-23, décision explicite).
alter table app_settings add column if not exists heures_supp_log jsonb not null default '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
