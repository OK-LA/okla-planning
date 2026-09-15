-- File d'attente des SMS "votre planning a changé" (gestionnaire → salarié) — au lieu d'un envoi
-- immédiat à chaque modification (trop tôt pendant qu'on prépare/ajuste un planning pas encore
-- définitif), les modifications s'accumulent ici et un bouton dédié envoie tout d'un coup, groupé
-- par salarié. Synced (pas juste local) pour qu'Antoine et Gwen partagent la même file d'attente
-- et puissent l'un ou l'autre déclencher l'envoi, quel que soit l'appareil où les modifs ont été faites.
alter table app_settings add column if not exists pending_sms jsonb not null default '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
