import { supabase, unwrap } from '../lib/supabase';

// One private bucket. Folders decide who may read (see the storage rules in the migration):
//   <class_id>/materials/...              teacher uploads, whole class reads
//   <class_id>/submissions/<student_id>/... student uploads own, teacher reads
const BUCKET = 'class-files';
export const MAX_FILE_MB = 20;

// Same list as the bucket's allowed types (supabase/migrations/20261103020000_lock_helpers.sql).
export const ACCEPTED_FILES =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.zip';

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
}

export async function uploadClassFile(folder: string, file: File): Promise<{ path: string; name: string }> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Files can be up to ${MAX_FILE_MB} MB.`);
  const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  unwrap(await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined }));
  return { path, name: file.name };
}

export async function removeClassFile(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

// Every file under a folder, at any depth (storage lists one level at a time).
export async function removeFolder(folder: string) {
  const files: string[] = [];
  const walk = async (prefix: string) => {
    for (let offset = 0; ; offset += 1000) {
      const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
      if (!data || data.length === 0) return;
      for (const item of data) {
        const path = `${prefix}/${item.name}`;
        if (item.id) files.push(path);
        else await walk(path);
      }
      if (data.length < 1000) return;
    }
  };
  await walk(folder);
  for (let i = 0; i < files.length; i += 100) await supabase.storage.from(BUCKET).remove(files.slice(i, i + 100));
}

// Files are private, so each open makes a link that works for one minute.
export async function openClassFile(path: string) {
  const { signedUrl } = unwrap(await supabase.storage.from(BUCKET).createSignedUrl(path, 60));
  window.open(signedUrl, '_blank', 'noopener');
}
