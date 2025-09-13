import { get, set, del, keys } from "idb-keyval";

export type PdfMeta = {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
};

const blobKey = (id: string) => `pdf:blob:${id}`;
const metaKey = (id: string) => `pdf:meta:${id}`;

export async function savePdf(file: File): Promise<PdfMeta> {
  const id = crypto.randomUUID();
  const meta: PdfMeta = {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    addedAt: Date.now(),
  };
  await set(blobKey(id), file);
  await set(metaKey(id), meta);
  return meta;
}

export async function getPdfBlob(id: string): Promise<Blob | undefined> {
  return (await get(blobKey(id))) as Blob | undefined;
}

export async function getPdfMeta(id: string): Promise<PdfMeta | undefined> {
  return (await get(metaKey(id))) as PdfMeta | undefined;
}

export async function listPdfs(): Promise<PdfMeta[]> {
  const allKeys = await keys();
  const metas: PdfMeta[] = [];
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith("pdf:meta:")) {
      const meta = await get(k);
      if (meta) metas.push(meta as PdfMeta);
    }
  }
  metas.sort((a, b) => b.addedAt - a.addedAt);
  return metas;
}

export async function removePdf(id: string): Promise<void> {
  await del(blobKey(id));
  await del(metaKey(id));
}
