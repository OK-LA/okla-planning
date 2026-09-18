-- Code d'accès salarié secondaire, pour les gestionnaires (is_manager=true) qui veulent pouvoir
-- se connecter aussi côté salarié (voir leur propre planning, faire leurs propres demandes) sans
-- que leur code principal ne les route systématiquement vers l'écran gestionnaire — demande
-- explicite d'Antoine, 2026-09-18, pour lui-même (BA01) et Gwen (BG01).
alter table employees add column if not exists code_salarie text unique;

NOTIFY pgrst, 'reload schema';
