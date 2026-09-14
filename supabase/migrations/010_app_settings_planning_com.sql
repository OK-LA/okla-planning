-- Liste des événements commerciaux/marketing (calendrier "Planning Communication OK-LA"),
-- jusqu'ici codée en dur dans l'application (PLANNING_COM_DATA) et donc non modifiable sans
-- redéploiement. Un tableau simple {id, date, label} suffit (même volume et même forme que
-- motifs_absence/types_contrat, pas besoin d'une table relationnelle dédiée).
alter table app_settings add column if not exists planning_com jsonb not null default '[]'::jsonb;
-- Marque que l'amorçage initial (copie de l'ancienne liste codée en dur) a déjà eu lieu, pour ne
-- jamais le refaire — sans ce marqueur, vider complètement la liste volontairement la ferait
-- réapparaître au prochain rechargement/resynchro (vide == "jamais amorcé" serait ambigu).
alter table app_settings add column if not exists planning_com_seeded boolean not null default false;
