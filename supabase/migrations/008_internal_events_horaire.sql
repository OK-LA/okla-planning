-- Permet de préciser une plage horaire (ex : réunion de 14h à 15h30) pour un événement
-- interne. Colonnes texte simples (format "HH:MM"), nullables — un événement sans horaire
-- précisé reste affiché comme une journée entière, comportement actuel préservé.
alter table internal_events add column if not exists heure_debut text;
alter table internal_events add column if not exists heure_fin text;
