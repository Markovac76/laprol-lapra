-- ============================================================================
-- LAPRÓL LAPRA — Sorozat-színek tematizálása kategóriánként (v1.15).
-- Modellek = Kék család, Mese = Magenta család, Lego = Zöld család —
-- a családon belül minden sorozat saját árnyalatot kap (létrehozás
-- sorrendje szerint, sötéttől világosig). A bővített paletta a
-- js/state.js PAL_FAMILIES-ben már él (ugyanabból a hue/szaturációból
-- szisztematikus, egyenletes lightness-lépcsővel generálva).
--
-- Csak a jelenleg létező 9 sorozatot érinti — a Lego kategória további
-- 4 tervezett sorozata (Spider-Man, Batman, Jurassic Park, Ninjago) még
-- nincs felvéve, azokhoz a bővített palettából már eleve a megfelelő
-- családot/árnyalatot lehet választani, amikor létrejönnek.
-- ============================================================================

update public.series set szin = '#1d4063' where megnevezes = 'II VH Repülők';
update public.series set szin = '#295c8e' where megnevezes = 'Versenyautók - Forma 1';
update public.series set szin = '#377abe' where megnevezes = 'Volkswagen modellautógyűjtemény';
update public.series set szin = '#5d96d0' where megnevezes = 'Fast & Furious modellek';

update public.series set szin = '#611f49' where megnevezes = 'Disney könyvek';
update public.series set szin = '#9b3174' where megnevezes = 'Disney Hangoskönyvek';
update public.series set szin = '#c8519c' where megnevezes = 'A Mancs Őrjárat küldetései';

update public.series set szin = '#1d6351' where megnevezes = 'Lego Star Wars Magazin';
update public.series set szin = '#247b65' where megnevezes = 'Lego Marvel';

-- Kész.
