import { decodificarHtmlDiputados, parseIndiceDiputados, type LeyIndice } from "./indice.js";

const BASE = "https://www.diputados.gob.mx/LeyesBiblio/";
const USER_AGENT = "faro-osc/0.0 (corpus legal abierto para OSC)";

type Fetch = typeof fetch;

async function descargar(url: string, f: Fetch): Promise<Uint8Array> {
  const res = await f(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Diputados respondió ${res.status} para ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function descargarIndice(f: Fetch = fetch): Promise<LeyIndice[]> {
  const html = decodificarHtmlDiputados(await descargar(`${BASE}index.htm`, f));
  const leyes = parseIndiceDiputados(html);
  // Si el sitio cambia su HTML, es mejor fallar que dar por vacío el catálogo.
  if (leyes.length < 100) {
    throw new Error(`El índice de Diputados devolvió solo ${leyes.length} leyes; ¿cambió el formato?`);
  }
  return leyes;
}

export async function descargarPdfLey(codigo: string, f: Fetch = fetch): Promise<Uint8Array> {
  if (!/^[A-Za-z0-9_]+$/.test(codigo)) throw new Error(`Código de ley inválido: ${codigo}`);
  const bytes = await descargar(`${BASE}pdf/${codigo}.pdf`, f);
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error(`La respuesta para ${codigo} no es un PDF`);
  }
  return bytes;
}
