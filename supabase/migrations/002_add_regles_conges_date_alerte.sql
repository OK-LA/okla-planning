-- Ajout d'une colonne oubliée lors de la migration 001 : app_settings.regles_conges_date_alerte
-- (existe côté app dans params.reglesConges.dateAlerte, jamais reportée dans le schéma initial).
alter table app_settings add column if not exists regles_conges_date_alerte date;
