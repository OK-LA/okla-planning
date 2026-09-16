-- Phase 2 sécurité : pont d'authentification. Ajoute un identifiant stable par employé pour
-- signer un JWT ("authenticated"), et un indicateur gestionnaire par personne — remplace le mot
-- de passe gestionnaire partagé (jamais synchronisé entre appareils) par une vraie distinction
-- par employé, sur décision explicite d'Antoine (2026-09-16).
-- Purement additif (colonnes nouvelles avec défaut) : si besoin de revenir en arrière, l'ancien
-- code (avant Phase 2) continue de fonctionner à l'identique sans y toucher.
alter table employees add column if not exists auth_uid uuid not null default gen_random_uuid() unique;
alter table employees add column if not exists is_manager boolean not null default false;

-- Antoine (BA01) et Gwen (BG01) : les deux seuls comptes gestionnaire pour l'instant. Un futur
-- 3e gestionnaire nécessitera un UPDATE manuel similaire (pas d'interface pour l'instant).
update employees set is_manager = true where id in ('1', 'BG01');

NOTIFY pgrst, 'reload schema';
