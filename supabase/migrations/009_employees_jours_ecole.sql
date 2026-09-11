-- Jours de la semaine (1=lundi ... 6=samedi, même échelle que repos_fixe_weekday) où un
-- apprenti est en centre de formation plutôt qu'au magasin/entrepôt. Tableau (jsonb) car un
-- apprenti peut avoir plusieurs jours d'école par semaine, contrairement au repos fixe (un seul
-- jour). Vide par défaut : comportement actuel préservé pour tout le monde.
alter table employees add column if not exists jours_ecole jsonb not null default '[]'::jsonb;
