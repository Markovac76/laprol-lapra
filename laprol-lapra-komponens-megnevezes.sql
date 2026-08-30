-- ============================================================================
-- LAPRÓL LAPRA — Komponens-szintű "Megnevezés" mező.
-- Futtatás: scripts/run-migration.js (közvetlen Postgres-kapcsolat).
--
-- A "több azonos típusú komponens egy Számon" funkció NEM igényel séma-
-- változást: a components/draft_components táblákon sosem volt
-- UNIQUE(issue_id, tipus) / UNIQUE(draft_issue_id, tipus) megszorítás —
-- ez eddig kizárólag a kliens-oldali (it.comps[tipus] map) modell korlátja
-- volt, nem az adatbázisé. Ez a migráció kizárólag az opcionális, szabad
-- szöveges "megnevezes" mezőt adja hozzá a komponens-táblákhoz.
-- Idempotens: nyugodtan újrafuttatható.
-- ============================================================================

alter table public.components add column if not exists megnevezes text;
alter table public.draft_components add column if not exists megnevezes text;

-- Kész.
