-- Phase 2 (merits):
--   * Same school: a student can only join a class (or be added to one, or get a merit)
--     when they and the teacher are at the same school. If either has no school set yet,
--     it is allowed, because there is nothing to compare.
--   * Merits can be edited by the teacher who gave them: points, reason and details only.
--   * Optional "details" text on a merit (the reason stays required).
-- Safe to run again.

-- ---------- Same school ----------
create or replace function public.same_school(a uuid, b uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select pa.school_id is null or pb.school_id is null or pa.school_id = pb.school_id
       from public.profiles pa, public.profiles pb
      where pa.id = a and pb.id = b),
    false);
$$;
revoke execute on function public.same_school(uuid, uuid) from public, anon;
grant execute on function public.same_school(uuid, uuid) to authenticated;

create or replace function public.join_class(code text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  cid uuid;
  tid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  select id, teacher_id into cid, tid from public.classes where join_code = upper(trim(code));
  if cid is null then
    raise exception 'No class has that code';
  end if;
  if not public.same_school(auth.uid(), tid) then
    raise exception 'That class is at another school. Check the code, or the school on your Profile.';
  end if;
  insert into public.class_members (class_id, user_id)
  values (cid, auth.uid())
  on conflict do nothing;
  return cid;
end;
$$;
revoke execute on function public.join_class(text) from public, anon;
grant execute on function public.join_class(text) to authenticated;

drop policy if exists "class_members: teacher adds" on public.class_members;
create policy "class_members: teacher adds" on public.class_members
  for insert to authenticated
  with check (public.teaches_class(class_id) and public.same_school(auth.uid(), user_id));

-- ---------- Merits: details, edit ----------
alter table public.merits add column if not exists details text;
alter table public.merits add column if not exists updated_at timestamptz;
alter table public.merits drop constraint if exists merits_details_length;
alter table public.merits add constraint merits_details_length check (details is null or length(details) <= 1000);

create or replace function public.merits_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.details := nullif(trim(new.details), '');
  return new;
end;
$$;
drop trigger if exists merits_touch on public.merits;
create trigger merits_touch before update on public.merits
  for each row execute function public.merits_touch();

drop policy if exists "merits: teacher gives to own class" on public.merits;
create policy "merits: teacher gives to own class" on public.merits
  for insert to authenticated
  with check (
    given_by = auth.uid()
    and class_id is not null
    and public.teaches_class(class_id)
    and exists (select 1 from public.class_members m where m.class_id = merits.class_id and m.user_id = student_id)
    and public.same_school(auth.uid(), student_id)
  );

drop policy if exists "merits: giver edits" on public.merits;
create policy "merits: giver edits" on public.merits
  for update to authenticated
  using (given_by = auth.uid())
  with check (given_by = auth.uid());

-- Only these columns can change; who, which class and when stay as given.
revoke update on public.merits from authenticated;
grant update (points, reason, details) on public.merits to authenticated;
