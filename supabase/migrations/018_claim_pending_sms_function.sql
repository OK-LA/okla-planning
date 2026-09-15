-- Lit ET vide la file d'attente des SMS en une seule opération atomique (verrou de ligne côté
-- Postgres) — nécessaire car pending_sms est partagée entre Antoine et Gwen sur des appareils
-- différents. Un simple "lire en JS puis écrire []" depuis le client laisserait une fenêtre où
-- les deux pourraient lire la même file avant que l'un des deux ne l'ait vidée, et enverraient
-- alors les mêmes SMS deux fois.
create or replace function claim_pending_sms()
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select pending_sms into result from app_settings where id = true for update;
  update app_settings set pending_sms = '[]'::jsonb where id = true;
  return coalesce(result, '[]'::jsonb);
end;
$$;
grant execute on function claim_pending_sms() to anon, authenticated;
