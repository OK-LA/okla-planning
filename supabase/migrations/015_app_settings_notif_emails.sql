-- Adresses email prévenues par notification (nouvelle demande, absence signalée, retard...) —
-- voir la Supabase Edge Function `send-notification` (dossier supabase/functions) pour l'envoi
-- réel via Resend.
alter table app_settings add column if not exists notif_emails jsonb not null default '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
