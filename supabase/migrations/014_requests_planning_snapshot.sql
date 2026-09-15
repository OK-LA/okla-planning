-- Quand un CP est validé, on capture désormais un instantané du planning juste avant (jour
-- travaillé habituel, exception ponctuelle comme une formation...) pour pouvoir le restaurer
-- exactement si le CP est ensuite annulé ou modifié, plutôt que de tout remettre à "repos".
alter table requests add column if not exists planning_snapshot jsonb;
