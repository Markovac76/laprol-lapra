-- ============================================================================
-- LAPRÓL LAPRA — member_issue_data.ar_auto jelző (egyszeri, Supabase SQL Editor)
--
-- Cél: megkülönböztetni az AUTOMATIKUSAN kitöltött fizetett árat a KÉZItől.
-- Így amikor a felhasználó az összes komponenst kiveszi „megvan"-ból (és a
-- fizetett_ar visszaáll „nem ismert"-re), a rendszer CSAK az auto-értéket nullázza,
-- a kézzel beírt árat megőrzi.
--
-- Meglévő sorok (korábbi auto-kitöltés / backfill) maradjanak ar_auto=true — ezt a
-- default adja. Kézi szerkesztéskor az app ar_auto=false-ra állítja.
--
-- FUTTATÁS: a hozzá tartozó front-end deploy ELŐTT (a kód már erre a mezőre épít).
-- ============================================================================

alter table public.member_issue_data
  add column if not exists ar_auto boolean not null default true;
