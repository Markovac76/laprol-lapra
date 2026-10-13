-- 40. lépés — a „Teszt Kiadó" próbasor törlése a Listákból (pontosan 1 sor, különben megáll).
do $$
declare n int;
begin
  delete from public.lists
   where id = 'ea9e5efa-72fb-480c-b69c-4e2a2c185d06' and tipus = 'kiado' and ertek = 'teszt_kiado'
     and not exists (select 1 from public.series where kiado = 'teszt_kiado')
     and not exists (select 1 from public.draft_series where kiado = 'teszt_kiado');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Teszt Kiadó: % sor törlődött volna (1 kell) — megszakítva.', n;
  end if;
end $$;
