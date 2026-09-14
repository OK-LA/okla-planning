-- CRUD des types de journée planning : types personnalisés ajoutés par le gestionnaire
-- (custom_types) + libellés/abréviations personnalisés pour les 9 types d'origine
-- (type_labels). Les couleurs des types d'origine utilisaient déjà app_settings.type_colors ;
-- on ne touche pas à ce mécanisme, seulement aux libellés et à l'ajout de nouveaux types.
alter table app_settings add column if not exists custom_types jsonb not null default '[]'::jsonb;
alter table app_settings add column if not exists type_labels jsonb not null default '{}'::jsonb;
