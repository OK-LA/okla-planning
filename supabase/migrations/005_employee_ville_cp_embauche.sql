-- Ajoute ville, code postal (séparés de l'adresse en texte libre) et date d'arrivée dans
-- l'entreprise (date d'embauche, distincte de date_fin qui est la fin de contrat) — champs
-- manquants signalés par Antoine, nécessaires aussi pour une future règle CP par ancienneté.
alter table employees add column if not exists ville text;
alter table employees add column if not exists code_postal text;
alter table employees add column if not exists date_embauche date;
