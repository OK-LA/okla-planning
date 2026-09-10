#!/usr/bin/env node
// Migration ponctuelle : okla_store (JSONB, 1 ligne par section) -> nouvelles tables relationnelles.
// À exécuter UNE FOIS depuis un poste local, jamais depuis le navigateur (nécessite la clé service_role).
//
// Usage :
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-to-relational.mjs --dry-run
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-to-relational.mjs
//   ... avec --reset pour vider les nouvelles tables avant réinsertion (relance après une 1re tentative)
//   ... avec --core-only pour ne migrer que employees + site_settings + app_settings
//       (app pas encore en production : planning/requests/absences/events/mur_posts
//       repoussés à une 2e passe sur des données plus propres — décision 2026-09-08)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const RESET = process.argv.includes('--reset');
const CORE_ONLY = process.argv.includes('--core-only');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variables manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies dans l\'environnement.');
  console.error('   (Dashboard Supabase → Settings → API → service_role key. Ne jamais la committer.)');
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function restGet(path) {
  const r = await fetch(`${REST}/${path}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function restInsert(table, rows) {
  if (!rows.length) return { table, count: 0 };
  if (DRY_RUN) return { table, count: rows.length, dryRun: true };
  const r = await fetch(`${REST}/${table}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`INSERT ${table} → ${r.status} ${await r.text()}`);
  return { table, count: rows.length };
}

async function restReset(table) {
  if (DRY_RUN) return;
  // DELETE sans filtre = vide la table entière (PostgREST l'autorise, RLS désactivée sur ces tables).
  const r = await fetch(`${REST}/${table}?id=not.is.null`, { method: 'DELETE', headers: HEADERS })
    .catch(() => null);
  // Certaines tables ont une PK composite sans colonne 'id' -> filtre générique alternatif.
  if (!r || !r.ok) {
    await fetch(`${REST}/${table}`, { method: 'DELETE', headers: { ...HEADERS, Prefer: 'return=minimal' } });
  }
}

async function restCount(table) {
  const r = await fetch(`${REST}/${table}?select=*`, {
    headers: { ...HEADERS, Prefer: 'count=exact', Range: '0-0' },
  });
  const range = r.headers.get('content-range'); // ex. "0-0/42"
  return range ? parseInt(range.split('/')[1], 10) : null;
}

function planningKeyParts(key) {
  // clé = `${empId}_${YYYY-MM-DD}` — la date fait toujours 10 caractères, on la retire par la fin.
  const date = key.slice(-10);
  const empId = key.slice(0, -11);
  return { empId, date };
}

async function main() {
  console.log(`\n=== Migration okla_store → tables relationnelles ${DRY_RUN ? '(DRY RUN — rien ne sera écrit)' : '(ÉCRITURE RÉELLE)'} ===\n`);

  console.log('Lecture de okla_store...');
  const rows = await restGet('okla_store?select=section,data,updated_at');
  const sections = Object.fromEntries(rows.map(r => [r.section, r.data]));

  if (!DRY_RUN) {
    const { writeFileSync, mkdirSync } = await import('fs');
    mkdirSync('backups', { recursive: true });
    const backupPath = `backups/okla_store_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(backupPath, JSON.stringify(rows, null, 2));
    console.log(`Sauvegarde brute écrite : ${backupPath}`);
  }

  const employees = sections.employees || [];
  const planning = sections.planning || {};
  const requests = sections.requests || [];
  const absences = sections.absences || [];
  const eventTypes = sections.event_types || [];
  const events = sections.events || [];
  const sc = sections.sc || {};
  const params = sections.params || {};

  const empIds = new Set(employees.map(e => e.id));

  // ── Résumé pré-vol ──
  console.log('\n--- Résumé des données trouvées ---');
  console.log(`Employés            : ${employees.length}`);
  console.log(`Lignes de planning  : ${Object.keys(planning).length}`);
  console.log(`Demandes (requests) : ${requests.length}`);
  console.log(`Absences            : ${absences.length}`);
  console.log(`Types d'événements  : ${eventTypes.length}`);
  console.log(`Événements          : ${events.length}`);
  console.log(`Sites (sc)          : ${Object.keys(sc).length}`);
  console.log(`Événements internes : ${(params.evInternes || []).length}`);
  console.log(`Posts mur social    : ${(params.murPosts || []).length}`);
  const jokerKeys = Object.keys(params.jokers || {});
  console.log(`Jokers CP           : ${jokerKeys.length}`);
  const soldesInitiaux = params.soldesInitiaux || {};
  const reposFixeParCode = params.reposFixeParCode || {};
  console.log(`params.soldesInitiaux non vide  : ${Object.keys(soldesInitiaux).length > 0 ? `OUI (${Object.keys(soldesInitiaux).length} entrées, non migré — code mort présumé, à vérifier)` : 'non (attendu, code mort confirmé)'}`);
  console.log(`params.reposFixeParCode présent : ${Object.keys(reposFixeParCode).length > 0 ? `${Object.keys(reposFixeParCode).length} entrées (seed statique, non migré — reposFixe résolu déjà sur les employés)` : 'vide'}`);

  // ── Vérification d'intégrité (références employé) ──
  // Décision validée avec Antoine (2026-09-08) : les entrées orphelines (planning
  // rattaché à un id d'employé qui n'existe plus — anciens ids numériques, employés
  // partis comme Sofian/ES04, fiches disparues comme E22) sont EXCLUES de la migration,
  // pas bloquantes. Elles restent récupérables dans la sauvegarde JSON (backups/).
  console.log('\n--- Vérification des références employé ---');
  const planningOrphanKeys = new Set();
  for (const key of Object.keys(planning)) {
    const { empId } = planningKeyParts(key);
    if (!empIds.has(empId)) planningOrphanKeys.add(key);
  }
  const requestOrphanIds = new Set();
  for (const r of requests) {
    if ((r.empId && !empIds.has(r.empId)) || (r.cibleId && !empIds.has(r.cibleId))) requestOrphanIds.add(r.id);
  }
  const absenceOrphanIds = new Set();
  for (const a of absences) {
    if ((a.empId && !empIds.has(a.empId)) || (a.rempId && !empIds.has(a.rempId))) absenceOrphanIds.add(a.id);
  }
  const eventOrphanIds = new Set();
  for (const ev of events) {
    if (ev.portee === 'employe' && ev.cible && !empIds.has(ev.cible)) eventOrphanIds.add(ev.id);
  }
  const murPostOrphanIds = new Set();
  for (const p of (params.murPosts || [])) {
    if (p.auteurId && p.auteurId !== 'mgr' && !empIds.has(p.auteurId)) murPostOrphanIds.add(p.id);
  }

  const orphanTotal = planningOrphanKeys.size + requestOrphanIds.size + absenceOrphanIds.size + eventOrphanIds.size + murPostOrphanIds.size;
  if (orphanTotal) {
    console.log(`⚠️  ${orphanTotal} référence(s) orpheline(s) trouvée(s) — exclues de la migration (voir sauvegarde JSON pour les retrouver) :`);
    if (planningOrphanKeys.size) console.log(`   - planning : ${planningOrphanKeys.size} lignes (ids : ${[...new Set([...planningOrphanKeys].map(k => planningKeyParts(k).empId))].join(', ')})`);
    if (requestOrphanIds.size) console.log(`   - requests : ${requestOrphanIds.size} (ids : ${[...requestOrphanIds].join(', ')})`);
    if (absenceOrphanIds.size) console.log(`   - absences : ${absenceOrphanIds.size} (ids : ${[...absenceOrphanIds].join(', ')})`);
    if (eventOrphanIds.size) console.log(`   - events : ${eventOrphanIds.size} (ids : ${[...eventOrphanIds].join(', ')})`);
    if (murPostOrphanIds.size) console.log(`   - mur_posts : ${murPostOrphanIds.size} (ids : ${[...murPostOrphanIds].join(', ')})`);
  } else {
    console.log('✅ Aucune référence orpheline.');
  }

  if (DRY_RUN) {
    console.log('\n(Dry-run terminé. Relancer sans --dry-run pour écrire réellement.)\n');
    return;
  }

  // ── Reset optionnel ──
  const targetTables = [
    'mur_post_comments', 'mur_post_reactions', 'mur_posts',
    'employee_leave_jokers', 'internal_events', 'events', 'event_types',
    'absences', 'requests', 'planning_entries', 'site_settings', 'employees',
  ];
  if (RESET) {
    console.log('\n--reset : purge des nouvelles tables avant réinsertion...');
    for (const t of targetTables) await restReset(t);
  }

  // ── Reshape + insertion (ordre FK-safe) ──
  console.log('\n--- Écriture ---');

  const employeeRows = employees.map(e => ({
    id: e.id,
    code: e.code || '',
    name: e.name || '',
    email: e.email || null,
    tel: e.tel || null,
    addr: e.addr || null,
    site: e.site || '',
    slot: e.slot || null,
    has_children: !!e.hasChildren,
    enfants: e.enfants || [],
    contrat_type: e.typeContrat || null,
    date_fin: e.dateFin || null,
    solde_cp_manuel: e.soldeCPManuel ?? null,
    solde_cp_manuel_date: e.soldeCPManuelDate || null,
    repos_fixe_weekday: (params.reposFixe && params.reposFixe[e.id] != null) ? params.reposFixe[e.id] : null,
  }));
  console.log(await restInsert('employees', employeeRows));

  const siteSettingsRows = Object.keys(sc).map(site => ({
    site,
    color: sc[site]?.color || '#000000',
    bg: sc[site]?.bg || '#ffffff',
    border: sc[site]?.border || '#000000',
    min_staff: (params.minStaff && params.minStaff[site]) || 1,
    adresse: (params.adresses && params.adresses[site]) || null,
    rotation_samedis_weeks: (params.rotationSamedis && params.rotationSamedis[site]) || 2,
  }));
  console.log(await restInsert('site_settings', siteSettingsRows));

  let planningRows = [], requestRows = [], absenceRows = [], eventTypeRows = [],
    eventRows = [], internalEventRows = [], jokerRows = [], murPostRows = [],
    reactionRows = [], commentRows = [];

  if (CORE_ONLY) {
    console.log('--core-only : planning / requests / absences / events / mur social non migrés (2e passe prévue plus tard).');
  } else {
    planningRows = Object.entries(planning)
      .filter(([key]) => !planningOrphanKeys.has(key))
      .map(([key, val]) => {
        const { empId, date } = planningKeyParts(key);
        return { employee_id: empId, entry_date: date, type: val.type, site: val.site || null, note: val.note || null };
      });
    console.log(await restInsert('planning_entries', planningRows));

    requestRows = requests.filter(r => !requestOrphanIds.has(r.id)).map(r => ({
      id: r.id,
      type: r.type,
      status: r.status,
      emp_id: r.empId,
      emp_name: r.empName || null,
      emp_email: r.empEmail || null,
      date_debut: r.dateDebut || null,
      date_fin: r.dateFin || null,
      date_a: r.dateA || null,
      date_b: r.dateB || null,
      cible_id: r.cibleId || null,
      cible_name: r.cibleName || null,
      cible_email: r.cibleEmail || null,
      jours_ouvres: r.joursOuvres ?? null,
      note: r.note || null,
    }));
    console.log(await restInsert('requests', requestRows));

    absenceRows = absences.filter(a => !absenceOrphanIds.has(a.id)).map(a => ({
      id: a.id,
      emp_id: a.empId,
      emp_name: a.empName || null,
      emp_site: a.empSite || null,
      emp_tel: a.empTel || null,
      date_str: a.dateStr,
      motif: a.motif || null,
      note: a.note || null,
      resolved: !!a.resolved,
      remp_id: a.rempId || null,
      remp_name: a.rempName || null,
      source: a.source || null,
    }));
    console.log(await restInsert('absences', absenceRows));

    eventTypeRows = eventTypes.map(t => ({
      id: t.id,
      label: t.label,
      color: t.color,
      is_vacances: !!t.isVacances,
    }));
    console.log(await restInsert('event_types', eventTypeRows));

    eventRows = events.filter(ev => !eventOrphanIds.has(ev.id)).map(ev => ({
      id: ev.id,
      type_id: ev.typeId,
      date_debut: ev.dateDebut,
      date_fin: ev.dateFin,
      portee: ev.portee,
      cible: ev.cible || null,
    }));
    console.log(await restInsert('events', eventRows));

    internalEventRows = (params.evInternes || []).map(ie => ({
      id: ie.id,
      type: ie.type,
      event_date: ie.date,
      label: ie.label || null,
    }));
    console.log(await restInsert('internal_events', internalEventRows));

    jokerRows = Object.entries(params.jokers || {}).filter(([empId]) => empIds.has(empId)).flatMap(([empId, val]) => {
      // forme attendue : { annee: {count} } ou { annee, count } selon la version — on gère les deux.
      if (val && typeof val === 'object' && val.annee !== undefined && val.count !== undefined) {
        return [{ employee_id: empId, periode_key: String(val.annee), count: val.count }];
      }
      return Object.entries(val || {}).map(([periode, v]) => ({
        employee_id: empId,
        periode_key: String(periode),
        count: (v && typeof v === 'object') ? (v.count ?? 0) : v,
      }));
    });
    console.log(await restInsert('employee_leave_jokers', jokerRows));

    const murPosts = (params.murPosts || []).filter(p => !murPostOrphanIds.has(p.id));
    murPostRows = murPosts.map(p => ({
      id: String(p.id),
      auteur_id: p.auteurId || null,
      auteur_nom: p.auteurNom || null,
      auteur_role: p.auteurRole || null,
      texte: p.texte || null,
      photo_url: p.photoUrl || null,
    }));
    console.log(await restInsert('mur_posts', murPostRows));

    reactionRows = murPosts.flatMap(p =>
      Object.entries(p.reactions || {}).flatMap(([emoji, userIds]) =>
        (userIds || []).map(uid => ({ post_id: String(p.id), emoji, employee_id: uid }))
      )
    );
    console.log(await restInsert('mur_post_reactions', reactionRows));

    commentRows = murPosts.flatMap(p =>
      (p.comments || []).map(c => ({
        id: String(c.id),
        post_id: String(p.id),
        auteur_id: c.auteurId || null,
        auteur_nom: c.auteurNom || null,
        texte: c.texte || null,
      }))
    );
    console.log(await restInsert('mur_post_comments', commentRows));
  }

  // ── app_settings (ligne unique, update plutôt qu'insert) ──
  const appSettingsBody = {
    verrou: !!params.verrou,
    type_colors: params.typeColors || {},
    motifs_absence: params.motifsAbsence || [],
    regles_enfant_malade: params.reglesEnfantMalade || {},
    samedis_pleins: params.samedisPleins || {},
    regles_conges_quota: (params.reglesConges && params.reglesConges.quota) || 25,
    sam_speciaux: params.samSpeciaux || { premiers: true, soldes: true },
  };
  if (!DRY_RUN) {
    const r = await fetch(`${REST}/app_settings?id=eq.true`, {
      method: 'PATCH',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify(appSettingsBody),
    });
    if (!r.ok) throw new Error(`PATCH app_settings → ${r.status} ${await r.text()}`);
  }
  console.log({ table: 'app_settings', count: 1 });

  // ── Post-vol : recomptage ──
  console.log('\n--- Vérification post-écriture ---');
  const checks = CORE_ONLY ? [
    ['employees', employeeRows.length],
    ['site_settings', siteSettingsRows.length],
  ] : [
    ['employees', employeeRows.length],
    ['planning_entries', planningRows.length],
    ['requests', requestRows.length],
    ['absences', absenceRows.length],
    ['event_types', eventTypeRows.length],
    ['events', eventRows.length],
    ['internal_events', internalEventRows.length],
    ['site_settings', siteSettingsRows.length],
    ['employee_leave_jokers', jokerRows.length],
    ['mur_posts', murPostRows.length],
    ['mur_post_reactions', reactionRows.length],
    ['mur_post_comments', commentRows.length],
  ];
  let allOk = true;
  for (const [table, expected] of checks) {
    const actual = await restCount(table);
    const ok = actual === expected;
    allOk = allOk && ok;
    console.log(`${ok ? '✅' : '❌'} ${table} : attendu ${expected}, trouvé ${actual}`);
  }
  console.log(allOk ? '\n✅ Migration terminée, tous les comptages correspondent.\n' : '\n❌ Écarts détectés — à examiner avant de continuer.\n');
}

main().catch(e => {
  console.error('\n❌ Erreur pendant la migration :', e.message);
  process.exit(1);
});
