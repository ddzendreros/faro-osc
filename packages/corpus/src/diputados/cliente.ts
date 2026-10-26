import { parseDecretosRef, type DecretoReforma } from "./decretos.js";
import { decodificarHtmlDiputados, parseIndiceDiputados, type LeyIndice } from "./indice.js";

const BASE = "https://www.diputados.gob.mx/LeyesBiblio/";
const USER_AGENT = "faro-osc/0.0 (corpus legal abierto para OSC)";

type Fetch = typeof fetch;

const INTENTOS = 3;
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * El sitio de Diputados corta conexiones de vez en cuando ("terminated") y a veces responde 5xx:
 * se reintenta con espera creciente. Un 4xx (p. ej. 404) no se reintenta, no se arregla solo.
 */
async function descargar(url: string, f: Fetch): Promise<Uint8Array> {
  let ultimoError: unknown;
  for (let i = 0; i < INTENTOS; i++) {
    try {
      const res = await f(url, { headers: { "user-agent": USER_AGENT } });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      if (res.status < 500) throw new ErrorNoReintentable(`Diputados respondió ${res.status} para ${url}`);
      ultimoError = new Error(`Diputados respondió ${res.status} para ${url}`);
    } catch (e) {
      if (e instanceof ErrorNoReintentable) throw e;
      ultimoError = e;
    }
    if (i < INTENTOS - 1) await esperar(1000 * 2 ** i);
  }
  throw new Error(`No se pudo descargar ${url} tras ${INTENTOS} intentos: ${ultimoError instanceof Error ? ultimoError.message : ultimoError}`);
}

class ErrorNoReintentable extends Error {}

export async function descargarIndice(f: Fetch = fetch): Promise<LeyIndice[]> {
  const html = decodificarHtmlDiputados(await descargar(`${BASE}index.htm`, f));
  const leyes = parseIndiceDiputados(html);
  // Si el sitio cambia su HTML, es mejor fallar que dar por vacío el catálogo.
  if (leyes.length < 100) {
    throw new Error(`El índice de Diputados devolvió solo ${leyes.length} leyes; ¿cambió el formato?`);
  }
  return leyes;
}

/** Decretos (publicación original y reformas) de una ley, del más reciente al más antiguo. */
export async function descargarDecretos(ley: Pick<LeyIndice, "refPagina">, f: Fetch = fetch): Promise<DecretoReforma[]> {
  if (!/^ref\/[A-Za-z0-9_]+\.htm$/.test(ley.refPagina)) throw new Error(`Página de historial inválida: ${ley.refPagina}`);
  const html = decodificarHtmlDiputados(await descargar(BASE + ley.refPagina, f));
  return parseDecretosRef(html, ley.refPagina);
}

export async function descargarPdfLey(codigo: string, f: Fetch = fetch): Promise<Uint8Array> {
  if (!/^[A-Za-z0-9_]+$/.test(codigo)) throw new Error(`Código de ley inválido: ${codigo}`);
  const bytes = await descargar(`${BASE}pdf/${codigo}.pdf`, f);
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error(`La respuesta para ${codigo} no es un PDF`);
  }
  return bytes;
}
