// Scarica tutti i file di TUTTI i bucket di Storage sul filesystem locale,
// preservando la struttura di cartelle. Riusabile per backup periodici (a
// differenza degli script one-off prefissati "tmp-", questo resta nel repo).
//
// Uso: npm run backup:storage -- <cartella-destinazione>
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createIngestionClient } from '../lib/supabase-client.js';

async function downloadFolder(
  supabase: ReturnType<typeof createIngestionClient>,
  bucket: string,
  folderPath: string,
  destRoot: string,
): Promise<number> {
  let count = 0;
  const { data: entries, error } = await supabase.storage.from(bucket).list(folderPath, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`list ${bucket}/${folderPath}: ${error.message}`);

  for (const entry of entries ?? []) {
    const entryPath = folderPath ? `${folderPath}/${entry.name}` : entry.name;
    const isFolder = entry.id === null;
    if (isFolder) {
      count += await downloadFolder(supabase, bucket, entryPath, destRoot);
      continue;
    }
    const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(entryPath);
    if (downloadError) throw new Error(`download ${bucket}/${entryPath}: ${downloadError.message}`);
    const destFile = join(destRoot, bucket, entryPath);
    await mkdir(dirname(destFile), { recursive: true });
    await writeFile(destFile, Buffer.from(await blob.arrayBuffer()));
    count += 1;
    console.log(`  ${bucket}/${entryPath}`);
  }
  return count;
}

async function main() {
  const destRoot = process.argv[2];
  if (!destRoot) {
    console.error('Uso: npm run backup:storage -- <cartella-destinazione>');
    process.exit(1);
  }

  const supabase = createIngestionClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(error.message);

  for (const bucket of buckets ?? []) {
    console.log(`Bucket: ${bucket.name}`);
    const n = await downloadFolder(supabase, bucket.name, '', destRoot);
    console.log(`  -> ${n} file scaricati`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
