-- Le code d'accès (identifiant de connexion salarié) est désormais modifiable par le
-- gestionnaire (v4.43) — la vérification d'unicité côté app compare seulement contre les
-- employés déjà chargés en mémoire, donc deux gestionnaires sur deux appareils différents
-- pourraient en théorie attribuer le même code à deux employés avant que l'un des deux ne
-- resynchronise. Une contrainte unique au niveau base bloque ce cas au lieu de le laisser
-- silencieusement créer deux employés avec le même code de connexion.
-- Vérifié le 2026-09-15 : aucun doublon existant sur les 21 employés en production.
alter table employees add constraint employees_code_unique unique (code);
