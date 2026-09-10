-- min_staff doit pouvoir stocker soit un nombre simple (même effectif tous les jours),
-- soit un objet {jour_semaine: nombre} pour varier par jour (ex: dimanche différent des
-- autres jours pour les "Dimanche exceptionnel" VIP). La colonne int actuelle ne permettait
-- que le nombre simple — la partie JS était déjà prête pour les deux formats.
alter table site_settings alter column min_staff drop default;
alter table site_settings alter column min_staff type jsonb using to_jsonb(min_staff);
alter table site_settings alter column min_staff set default '1'::jsonb;
