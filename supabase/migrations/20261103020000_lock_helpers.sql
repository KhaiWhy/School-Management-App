-- Lock down helper functions and file types. Safe to run more than once.
-- Run after 20261103000000_init.sql (Supabase → SQL Editor → paste → Run).

-- 1. Helpers used inside the access rules: only signed-in users need them.
--    (Signed-out visitors could otherwise call them through the API.)
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.teaches_class(uuid) from public, anon;
revoke execute on function public.in_class(uuid) from public, anon;
revoke execute on function public.assignment_class(uuid) from public, anon;
revoke execute on function public.new_join_code() from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.teaches_class(uuid) to authenticated;
grant execute on function public.in_class(uuid) to authenticated;
grant execute on function public.assignment_class(uuid) to authenticated;
grant execute on function public.new_join_code() to authenticated;

-- 2. Trigger functions are only ever run by their triggers, never called directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_role() from public, anon, authenticated;
revoke execute on function public.guard_submission() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- 3. Class files: up to 20 MB, and only documents, images and office files.
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf',
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic',
      'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.presentation',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/zip'
    ]
where id = 'class-files';
