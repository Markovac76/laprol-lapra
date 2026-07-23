-- LAPRÓL LAPRA — adatbetöltés (a te fiókodhoz kötve)
do $$
declare
  uid uuid := '25cb3724-02d4-4002-98b0-c93f74ef4e42';
  sid uuid;
  iid uuid;
begin
  -- === Sorozat: II VH Repülők ===
  insert into public.series (user_id, kiado, megnevezes, megjelenites, szin, components, sort_order)
  values (uid, 'RBA', 'II VH Repülők', 'Repülők', '#3a6ea5', '{"magazin","modell"}', 0)
  returning id into sid;
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 1, 'Supermarine Spitfire Mk VB', '2025-05-08', 1490, 1490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 2, 'North American P-51B Mustang', '2025-05-22', 2990, 2990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 3, 'Messerschmitt Bf 109F-4', '2025-06-05', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 4, 'Mitsubishi A6M3 Zero', '2025-06-19', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 5, 'Hawker Hurricane Mk IIB', '2025-07-03', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 6, 'Junkers Ju 87 Stuka', '2025-07-17', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 7, 'Boeing B-29 Enola Gay', '2025-07-31', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 8, 'Messerschmitt Me 262', '2025-08-14', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 9, 'Republic P-47D Thunderbolt', '2025-08-28', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 10, 'Handley Page Halifax B Mk III', '2025-09-11', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 11, 'Focke-Wulf Fw 190A-8', '2025-09-25', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 12, 'Vought F4U-1D Corsair', '2025-10-09', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 13, 'Junkers Ju 88 A-4', '2025-10-23', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 14, 'Mitsubishi G4M Betty', '2025-11-06', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 15, 'Dewoitine D.520', '2025-11-20', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 16, 'Vickers Wellington Mk X', '2025-12-04', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 17, 'Iljusin Il-4', '2025-12-18', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 18, 'Curtiss P-40B Warhawk', '2026-01-01', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 19, 'Douglas SBD Dauntless', '2026-01-15', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 20, 'Lavocskin La-7', '2026-01-29', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 21, 'Grumman F6F Hellcat', '2026-02-12', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 22, 'Armstrong Whitworth Whitley Mk V', '2026-02-26', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 23, 'Junkers Ju 52/3m', '2026-03-12', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 24, 'Fairey Swordfish', '2026-03-26', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 25, 'Heinkel He 177', '2026-04-09', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 26, 'Boeing B-17F Flying Fortress', '2026-04-23', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 27, 'Mikojan-Gurjevics MiG-3', '2026-05-07', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 28, 'Blohm & Voss BV 222 Wiking', '2026-05-21', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'hianyzik', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'hianyzik', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 29, 'Kawanishi H8K2 Emily', '2026-06-04', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 30, 'Consolidated B-24 Liberator', '2026-06-18', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 31, 'Avro Lancaster B Mk I', '2026-07-02', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 32, 'Morane-Saulnier MS.406', '2026-07-16', 5990, 5990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 33, 'Consolidated PBY-5A Catalina', '2026-07-30', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 34, 'Focke-Wulf Fw 200 Condor', '2026-08-13', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 35, 'Douglas C-47 Dakota', '2026-08-27', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 36, 'Dornier Do 24T', '2026-09-10', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 37, 'Yakovlev Yak-3', '2026-09-24', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 38, 'Consolidated PB2Y Coronado', '2026-10-08', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 39, 'Hawker Typhoon Mk IB', '2026-10-22', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 40, 'Douglas C-54 Skymaster', '2026-11-05', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 41, 'CANT Z.506B Airone', '2026-11-19', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 42, 'Short Stirling Mk III', '2026-12-03', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 43, 'Martin B-26 Marauder', '2026-12-17', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 44, 'Boeing B-29 Superfortress', '2026-12-31', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 45, 'North American B-25H Mitchell', '2027-01-14', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 46, 'Ilyushin Il-2M3 Sturmovik', '2027-01-28', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 47, 'Messerschmitt Bf 110', '2027-02-11', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 48, 'Fiat G.55 Centauro', '2027-02-25', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 49, 'Lockheed P-38 Lightning', '2027-03-11', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 50, 'De Havilland Mosquito FB Mk VI', '2027-03-25', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 51, 'Tupolev Tu-2', '2027-04-08', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 52, 'Gloster Meteor F Mk III', '2027-04-22', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 53, 'Savoia-Marchetti SM.79 Sparviero', '2027-05-06', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 54, 'Dornier Do 217', '2027-05-20', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 55, 'Northrop P-61 Black Widow', '2027-06-03', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 56, 'Polikarpov I-16 Type 24', '2027-06-17', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 57, 'Heinkel He 111', '2027-07-01', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 58, 'Bristol Beaufighter Mk X', '2027-07-15', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 59, 'Macchi C.202 Folgore', '2027-07-29', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 60, 'Bristol Blenheim Mk I', '2027-08-12', 5990, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  -- === Sorozat: Versenyautók - Forma 1 ===
  insert into public.series (user_id, kiado, megnevezes, megjelenites, szin, components, sort_order)
  values (uid, 'Centuria', 'Versenyautók - Forma 1', 'Forma 1', '#d21f2b', '{"magazin","modell"}', 1)
  returning id into sid;
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 1, 'MERCEDES-AMG F1 W10 EQ POWER+ – 2019 – LEWIS HAMILTON', '2025-08-13', 990, 990, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 2, 'McLAREN MP4/4 – 1988 – AYRTON SENNA', '2025-08-27', 2490, 2490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 3, 'FERRARI F2002 – 2002 – MICHAEL SCHUMACHER', '2025-09-10', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 4, 'RED BULL RACING RB16B – 2021 – MAX VERSTAPPEN', '2025-09-24', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 5, 'RENAULT R25 – 2005 – FERNANDO ALONSO', '2025-10-08', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 6, 'RED BULL RACING RB9 – 2013 – SEBASTIAN VETTEL', '2025-10-22', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 7, 'FERRARI F1-75 – 2022 – CHARLES LECLERC', '2025-11-05', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 8, 'ASTON MARTIN AMR23 – 2023 – FERNANDO ALONSO', '2025-11-19', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 9, 'ALPINE A522 – 2022 – ESTEBAN OCON', '2025-12-03', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 10, 'WILLIAMS FW15C – 1993 – ALAIN PROST', '2025-12-17', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 11, 'BMW-SAUBER F1.08 – 2008 – ROBERT KUBICA', '2025-12-31', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 12, 'TOLEMAN TG184 – 1984 – AYRTON SENNA', '2026-01-14', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 13, 'FERRARI F2007 – 2007 – KIMI RAIKKONEN', '2026-01-28', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 14, 'McLAREN MP 4/23 – 2008 – LEWIS HAMILTON', '2026-02-11', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 15, 'BENETTON B194 – 1994 – MICHAEL SCHUMACHER', '2026-02-25', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 16, 'RED BULL RACING RB19 – 2023 – MAX VERSTAPPEN', '2026-03-11', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 17, 'McLAREN MCL35M – 2021 – LANDO NORRIS', '2026-03-25', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 18, 'BRAWN GP01 – 2009 – JENSON BUTTON', '2026-04-08', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 19, 'ALPINE A521 – 2021 – FERNANDO ALONSO', '2026-04-22', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 20, 'HONDA RA 106 – 2006 – JENSON BUTTON', '2026-05-06', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 21, 'McLAREN MCL38 – 2024 – LANDO NORRIS', '2026-05-27', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 22, 'ASTON MARTIN AMR24 – FERNANDO ALONSO – 2024', '2026-06-03', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 23, 'BRABHAM BT 49 – 1981 – NELSON PIQUET', '2026-06-17', 5490, 5490, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'megvan', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 24, 'MERCEDES W11 – 2020 – LEWIS HAMILTON', '2026-07-01', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 25, 'FERRARI SF-24 – CHARLES LECLERC', '2026-07-15', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', 'nemkell', null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', 'nemkell', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 26, 'RED BULL RB20 – MAX VERSTAPPEN – 2024', '2026-07-29', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 27, 'McLAREN MCL35M – 2021 – DANIEL RICCIARDO', '2026-08-12', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 28, 'ARROWS A18 – 1997 – DAMON HILL', '2026-08-26', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 29, 'WILLIAMS FW07B – 1980 – ALAN JONES', '2026-09-09', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 30, 'FERRARI SF15-T – 2015 – SEBASTIAN VETTEL', '2026-09-23', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 31, 'LOTUS 97T – 1985 – AYRTON SENNA', '2026-10-07', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 32, 'RENAULT RS20 – 2020 – DANIEL RICCIARDO', '2026-10-21', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 33, 'MERCEDES-AMG F1 W13 E PERFORMANCE – 2022 – GEORGE RUSSELL', '2026-11-04', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 34, 'FERRARI SF21 – 2021 – CARLOS SAINZ', '2026-11-18', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 35, 'TYRRELL 006 – 1973 – JACKIE STEWART', '2026-12-02', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 36, 'MERCEDES-AMG F1 W14 E PERFORMANCE – 2023 – LEWIS HAMILTON', '2026-12-16', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 37, 'FORCE INDIA VJM09 – 2016 – SERGIO PEREZ', '2026-12-30', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 38, 'ASTON MARTIN AMR21 – 2021 – SEBASTIAN VETTEL', '2027-01-13', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 39, 'LOTUS 72D – 1972 – EMERSON FITTIPALDI', '2027-01-27', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 40, 'McLAREN M23 – 1976 – JAMES HUNT', '2027-02-10', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 41, 'McLAREN MCL60 – OSCAR PIASTRI – 2023', '2027-02-24', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 42, 'McLAREN MCL39 – LANDO NORRIS – 2025', '2027-03-10', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 43, 'MINARDI PS01 – 2001 – FERNANDO ALONSO', '2027-03-24', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 44, 'MERCEDES-AMG F1 W15 E PERFORMANCE – 2024 – LEWIS HAMILTON – SINGAPORE GRAND PRIX', '2027-04-07', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 45, 'WILLIAMS FW45 – 2023 – ALEXANDER ALBON', '2027-04-21', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 46, 'RED BULL RB21 – 2025 – MAX VERSTAPPEN – JAPANESE GRAND PRIX', '2027-05-05', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 47, 'LOTUS 79 – 1978 – MARIO ANDRETTI', '2027-05-19', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 48, 'ALPINE A524 – 2024 – PIERRE GASLY', '2027-06-02', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 49, 'RENAULT R.S. 18 – 2018 – NICO HULKENBERG', '2027-06-16', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 50, 'MERCEDES F1 W05 – 2014 – LEWIS HAMILTON', '2027-06-30', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 51, 'FERRARI 312 T2 – 1977 – NIKI LAUDA', '2027-07-14', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 52, 'McLAREN MCL33 – 2018 – FERNANDO ALONSO', '2027-07-28', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 53, 'WILLIAMS FW16 – 1994 – DAMON HILL', '2027-08-11', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 54, 'JORDAN 191 – 1991 – MICHAEL SCHUMACHER', '2027-08-25', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 55, 'MERCEDES W196S – 1955 – JUAN MANUEL FANGIO', '2027-09-08', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 56, 'WILLIAMS F11B – 1987 – NELSON PIQUET', '2027-09-22', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 57, 'MERCEDES W09 – 2018 – LEWIS HAMILTON', '2027-10-06', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 58, 'WILLIAMS FW 14B – 1992 – NIGEL MANSELL', '2027-10-20', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 59, 'LIGIER JS43 – 1996 – OLIVIER PANIS', '2027-11-03', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 60, 'SAUBER C37 – 2018 – CHARLES LECLERC', '2027-11-17', 5490, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'magazin', null, null, null);
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'modell', null, null, null);
  -- === Sorozat: Disney könyvek ===
  insert into public.series (user_id, kiado, megnevezes, megjelenites, szin, components, sort_order)
  values (uid, 'Hachette', 'Disney könyvek', 'Disney', '#7b52b8', '{"konyv"}', 2)
  returning id into sid;
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 1, 'A Szépség és a Szörnyeteg', '2026-01-31', 799, 799, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 2, 'Jégvarázs', '2026-02-14', 1999, 1999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 3, 'Hófehérke', '2026-02-28', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 4, 'Az Oroszlánkirály', '2026-03-14', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 5, 'Hamupipőke', '2026-03-28', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 6, 'A Dzsungel Könyve', '2026-04-11', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 7, 'Alíz csodaországban', '2026-04-25', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 8, 'A kis hableány', '2026-05-09', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 9, '101 kiskutya', '2026-05-23', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 10, 'Lilo és Stitch', '2026-06-06', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 11, 'Mulan', '2026-06-20', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 12, 'Dumbo', '2026-06-27', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 13, 'Encanto', '2026-07-04', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 14, 'Pocahontas', '2026-07-11', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 15, 'Agymanók', '2026-07-18', 3999, 3999, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', 'megvan', null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 16, 'Aranyhaj és a nagy gubanc', '2026-07-25', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 17, 'Bambi', '2026-08-01', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 18, 'A hercegnő és a béka', '2026-08-08', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 19, 'Vaiana', '2026-08-15', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 20, 'Merida a bátor', '2026-08-22', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 21, 'Toy Story', '2026-08-29', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 22, null, '2026-09-05', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 23, null, '2026-09-12', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 24, null, '2026-09-19', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 25, null, '2026-09-26', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 26, null, '2026-10-03', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 27, null, '2026-10-10', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 28, null, '2026-10-17', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 29, null, '2026-10-24', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 30, null, '2026-10-31', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 31, null, '2026-11-07', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 32, null, '2026-11-14', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 33, null, '2026-11-21', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 34, null, '2026-11-28', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 35, null, '2026-12-05', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 36, null, '2026-12-12', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 37, null, '2026-12-19', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 38, null, '2026-12-26', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 39, null, '2027-01-02', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 40, null, '2027-01-09', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 41, null, '2027-01-16', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 42, null, '2027-01-23', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 43, null, '2027-01-30', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 44, null, '2027-02-06', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 45, null, '2027-02-13', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 46, null, '2027-02-20', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 47, null, '2027-02-27', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 48, null, '2027-03-06', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 49, null, '2027-03-13', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 50, null, '2027-03-20', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 51, null, '2027-03-27', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 52, null, '2027-04-03', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 53, null, '2027-04-10', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 54, null, '2027-04-17', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 55, null, '2027-04-24', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 56, null, '2027-05-01', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 57, null, '2027-05-08', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 58, null, '2027-05-15', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 59, null, '2027-05-22', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 60, null, '2027-05-29', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 61, null, '2027-06-05', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 62, null, '2027-06-12', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 63, null, '2027-06-19', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 64, null, '2027-06-26', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 65, null, '2027-07-03', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 66, null, '2027-07-10', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 67, null, '2027-07-17', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 68, null, '2027-07-24', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 69, null, '2027-07-31', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 70, null, '2027-08-07', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 71, null, '2027-08-14', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 72, null, '2027-08-21', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 73, null, '2027-08-28', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 74, null, '2027-09-04', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 75, null, '2027-09-11', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 76, null, '2027-09-18', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 77, null, '2027-09-25', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 78, null, '2027-10-02', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 79, null, '2027-10-09', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
  insert into public.issues (user_id, series_id, lapszam, cim, megjelenes, fedelar, beszerzesi_ar, beszerzes_datuma)
  values (uid, sid, 80, null, '2027-10-16', 3999, null, null)
  returning id into iid;
  insert into public.components (user_id, issue_id, tipus, status, azonosito, jegyzet)
  values (uid, iid, 'konyv', null, null, null);
end $$;