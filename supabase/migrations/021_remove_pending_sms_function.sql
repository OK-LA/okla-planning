-- Retire, de façon atomique, toutes les entrées d'un salarié de la file d'attente SMS — pour
-- pouvoir l'exclure définitivement (pas juste la décocher/reporter) directement depuis la revue
-- avant envoi (Antoine, 2026-09-16). Même principe que claim_pending_sms/append_pending_sms :
-- un seul UPDATE côté serveur, jamais un "lire en JS puis écrire []" qui écraserait ce qu'un
-- autre gestionnaire aurait pu ajouter entre-temps.
create or replace function remove_pending_sms_for_employee(target_emp_id text)
returns void
language sql
as $$
  update app_settings
  set pending_sms = coalesce(
    (select jsonb_agg(elem) from jsonb_array_elements(pending_sms) elem
     where elem->>'empId' <> target_emp_id),
    '[]'::jsonb
  )
  where id = true;
$$;
grant execute on function remove_pending_sms_for_employee(text) to anon, authenticated;
