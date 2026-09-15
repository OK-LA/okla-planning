-- Numéros de téléphone prévenus par SMS (nouvelle demande, absence signalée, retard...) — voir
-- la Supabase Edge Function `send-sms` (dossier supabase/functions) pour l'envoi réel via
-- Capitole Mobile. Complète notif_emails (015) : les deux canaux sont indépendants, chacun ne
-- s'active que si au moins une adresse/numéro est configuré en Paramètres.
alter table app_settings add column if not exists notif_phones jsonb not null default '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
