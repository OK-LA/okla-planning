-- L'ordre d'affichage des employés (boutons ▲▼ dans l'onglet Employés et dans le planning) n'était
-- jamais persisté : S.employees est réordonné en mémoire, mais la table `employees` n'a pas de
-- notion d'ordre — un SELECT * sans colonne dédiée revient dans un ordre non garanti à chaque
-- rechargement, donc le tri manuel se perdait silencieusement.
alter table employees add column if not exists order_index integer;
