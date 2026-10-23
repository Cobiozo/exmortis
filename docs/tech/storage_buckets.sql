-- Magazyn plików (Supabase Storage) dla panelu exmortis — uruchomić RAZ w Supabase:
-- Dashboard → SQL Editor → wklej całość → Run. Skrypt można uruchomić ponownie (nic nie zdubluje).
--
-- Tworzy kubełki:  public  (okładki, muzyka Ciszy, tła — linki publiczne)
--                  private (pliki płatne, PDF, nagrania — tylko podpisane linki)
-- Limit pliku 500 MB (PDF ogranicza panel do 100 MB). UWAGA: globalny limit projektu
-- (Dashboard → Storage → Settings → Upload file size limit) musi być ≥ 500 MB — na planie Free
-- maksimum to 50 MB, większe pliki wymagają planu Pro.
--
-- Wgrywać/podpisywać/usuwać pliki może tylko zalogowane konto z rolą admin albo techniczna
-- (tabela public.exm_user, pole data->>'role'). Funkcje serwera działają kluczem service_role (bez zmian).

insert into storage.buckets (id, name, public, file_size_limit)
values ('public', 'public', true, 524288000), ('private', 'private', false, 524288000)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create or replace function public.exm_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exm_user u
    where lower(u.data->>'email') = lower(coalesce(auth.jwt()->>'email', ''))
      and u.data->>'role' in ('admin', 'techniczna')
  );
$$;
revoke all on function public.exm_is_staff() from public;
grant execute on function public.exm_is_staff() to authenticated;

drop policy if exists "exm staff select" on storage.objects;
drop policy if exists "exm staff insert" on storage.objects;
drop policy if exists "exm staff update" on storage.objects;
drop policy if exists "exm staff delete" on storage.objects;

create policy "exm staff select" on storage.objects for select to authenticated
  using (bucket_id in ('public', 'private') and public.exm_is_staff());
create policy "exm staff insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('public', 'private') and public.exm_is_staff());
create policy "exm staff update" on storage.objects for update to authenticated
  using (bucket_id in ('public', 'private') and public.exm_is_staff())
  with check (bucket_id in ('public', 'private') and public.exm_is_staff());
create policy "exm staff delete" on storage.objects for delete to authenticated
  using (bucket_id in ('public', 'private') and public.exm_is_staff());

-- Kontrola: powinny być 2 kubełki i 4 polityki.
select id, public, file_size_limit from storage.buckets where id in ('public', 'private');
select policyname, cmd from pg_policies where schemaname = 'storage' and policyname like 'exm staff%';
