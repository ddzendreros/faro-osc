import { extractText, getDocumentProxy } from "unpdf";

/** Texto de cada página del PDF, en orden. */
export async function extraerPaginasPdf(bytes: Uint8Array): Promise<string[]> {
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: false });
  return text;
}
