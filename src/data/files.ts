import { supabase, unwrap } from '../lib/supabase';

// One private bucket. Folders decide who may read (see the storage rules in the migration):
//   <class_id>/materials/...              teacher uploads, whole class reads
//   <class_id>/submissions/<student_id>/... student uploads own, teacher reads
const BUCKET = 'class-files';
export const MAX_FILE_MB = 20;

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

// Files are private, so each open makes a link that works for one minute.
export async function openClassFile(path: string) {
  const { signedUrl } = unwrap(await supabase.storage.from(BUCKET).createSignedUrl(path, 60));
  window.open(signedUrl, '_blank', 'noopener');
}
