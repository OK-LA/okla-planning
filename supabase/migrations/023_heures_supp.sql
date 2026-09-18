-- Compteur d'heures supplémentaires / à rattraper, tenu à jour par le gestionnaire depuis la
-- fiche employé. Signé : positif = heures supplémentaires (dues au salarié), négatif = heures à
-- rattraper. Affiché côté salarié uniquement quand non nul (Antoine, 2026-09-18).
alter table employees add column if not exists heures_supp numeric(5,1);

NOTIFY pgrst, 'reload schema';
