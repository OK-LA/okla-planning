-- Salariés à ne jamais proposer comme remplaçants (ex: personnel du Bureau qui ne remplace pas en
-- magasin). Réglable par salarié dans la fiche employé (case "Ne jamais proposer comme
-- remplaçant"). Antoine (id 1) et Emilie (id 5) sont exclus d'office, demande d'Antoine du
-- 2026-10-02.
alter table employees add column if not exists exclu_remplacement boolean not null default false;

update employees set exclu_remplacement = true where id in ('1', '5');

NOTIFY pgrst, 'reload schema';
