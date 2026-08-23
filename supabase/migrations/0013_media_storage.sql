-- Bucket público para logo e criativos (Vercel não persiste disco local).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  16777216,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read
  on storage.objects
  for select
  using (bucket_id = 'media');
