-- Ajoute des entrées à la file d'attente SMS de façon atomique (un seul UPDATE, sans lire puis
-- réécrire toute la ligne depuis le client) — nécessaire pour remettre en attente les salariés
-- décochés lors de la revue avant envoi (v4.47) sans risquer d'écraser une entrée qu'un autre
-- gestionnaire, sur un autre appareil, viendrait tout juste d'ajouter via un simple persist().
create or replace function append_pending_sms(entries jsonb)
returns void
language sql
as $$
  update app_settings set pending_sms = pending_sms || entries where id = true;
$$;
grant execute on function append_pending_sms(jsonb) to anon, authenticated;
