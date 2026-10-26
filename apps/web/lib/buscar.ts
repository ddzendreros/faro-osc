import { plegar } from "./formato";

export interface Doc {
  ley: string;
  numero: string;
  slug: string;
  texto: string;
}

export interface Segmento {
  texto: string;
  resaltado: boolean;
}

export interface Resultado {
  ley: string;
  numero: string;
  slug: string;
  /** true si la consulta nombraba este artículo ("LISR 82"), no solo palabras del texto. */
  exacto: boolean;
  fragmento: Segmento[];
}

const VACIAS = new Set([
  "de", "la", "el", "los", "las", "y", "o", "u", "e", "en", "a", "que", "del", "al", "por", "para",
  "con", "se", "su", "sus", "un", "una", "es", "lo", "como", "sin", "art", "articulo", "articulos",
]);

/** Raíz muy ligera: quita plural y vocal final, para que "donativos" y "donativo" coincidan. */
export function raiz(palabra: string): string {
  let p = palabra;
  if (p.length > 5 && p.endsWith("es")) p = p.slice(0, -2);
  else if (p.length > 4 && p.endsWith("s")) p = p.slice(0, -1);
  if (p.length > 4 && /[aoe]$/.test(p)) p = p.slice(0, -1);
  return p;
}

const palabras = (plegado: string) => plegado.match(/[a-z0-9]+/g) ?? [];

function raices(texto: string, conservarVacias = false): string[] {
  const todas = palabras(plegar(texto));
  const utiles = todas.filter((p) => !VACIAS.has(p));
  return (utiles.length || !conservarVacias ? utiles : todas).map(raiz);
}

const LATINOS = "bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies";
const REFERENCIA = new RegExp(`(?:^|\\s)(\\d{1,4})\\s*(º|°|o\\b)?\\s*(?:-\\s*|\\s+)?([a-z]\\b)?(?:[\\s-]*(${LATINOS})\\b)?`);

/** Clave comparable de un número de artículo: "82 Bis" y "82-bis" coinciden; "4o" y "4" también. */
export function claveNumero(numero: string): string {
  return plegar(numero).replace(/[^a-z0-9]/g, "").replace(/^(\d+)o/, "$1");
}

/** Detecta "LISR 82", "art. 82 bis" o "artículo 4o-A": una ley opcional y un número de artículo. */
export function parseReferencia(consulta: string, leyes: string[]): { ley?: string; clave: string } | null {
  const q = plegar(consulta);
  const ley = leyes.find((l) => new RegExp(`\\b${plegar(l)}\\b`).test(q));
  const sinLey = ley ? q.replace(new RegExp(`\\b${plegar(ley)}\\b`), " ") : q;
  const m = REFERENCIA.exec(sinLey);
  if (!m?.[1]) return null;
  // Un número suelto dentro de una frase ("2 meses") no es una referencia: se exige que la consulta
  // sea corta o que nombre explícitamente el artículo o la ley.
  const explicita = /\bart/.test(sinLey) || ley !== undefined;
  if (!explicita && palabras(sinLey).length > 2) return null;
  const resto = [m[1], m[2] ? "o" : "", m[3] ? `-${m[3]}` : "", m[4] ? ` ${m[4]}` : ""].join("");
  return { ley, clave: claveNumero(resto) };
}

/** true si, quitando la ley, el número y los sufijos, la consulta no tiene palabras de contenido. */
function soloReferencia(consulta: string, leyes: string[]): boolean {
  const codigos = new Set(leyes.map(plegar));
  const latinos = new Set(LATINOS.split("|"));
  return !palabras(plegar(consulta)).some(
    (p) => !VACIAS.has(p) && !codigos.has(p) && !latinos.has(p) && !/^\d/.test(p) && p.length > 1,
  );
}

function fragmento(texto: string, raicesConsulta: Set<string>): Segmento[] {
  const ANCHO = 260;
  const reg = /[A-Za-zÀ-ÿ0-9]+/g;
  let primera = -1;
  for (const m of texto.matchAll(reg)) {
    if (raicesConsulta.has(raiz(plegar(m[0])))) {
      primera = m.index;
      break;
    }
  }
  let ini = primera < 0 ? 0 : Math.max(0, primera - 90);
  if (ini > 0) ini = texto.indexOf(" ", ini) + 1 || ini;
  let fin = Math.min(texto.length, ini + ANCHO);
  if (fin < texto.length) fin = texto.lastIndexOf(" ", fin) > ini ? texto.lastIndexOf(" ", fin) : fin;
  const ventana = texto.slice(ini, fin).replace(/\s+/g, " ");

  const segmentos: Segmento[] = [];
  let cursor = 0;
  for (const m of ventana.matchAll(reg)) {
    if (!raicesConsulta.has(raiz(plegar(m[0])))) continue;
    if (m.index > cursor) segmentos.push({ texto: ventana.slice(cursor, m.index), resaltado: false });
    segmentos.push({ texto: m[0], resaltado: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < ventana.length) segmentos.push({ texto: ventana.slice(cursor), resaltado: false });
  if (ini > 0) segmentos.unshift({ texto: "…", resaltado: false });
  if (fin < texto.length) segmentos.push({ texto: "…", resaltado: false });
  return segmentos;
}

/**
 * Buscador en memoria (BM25 sobre raíces de palabra, sin acentos). Suficiente para el corpus de la
 * demo (cientos de artículos); el agente real usa búsqueda híbrida en Postgres.
 */
export function crearBuscador(docs: Doc[], leyes: string[]) {
  const K1 = 1.2;
  const B = 0.75;
  const indexados = docs.map((d) => {
    const tf = new Map<string, number>();
    const rs = raices(d.texto);
    for (const r of rs) tf.set(r, (tf.get(r) ?? 0) + 1);
    return { doc: d, tf, largo: rs.length, plano: plegar(d.texto), clave: claveNumero(d.numero) };
  });
  const df = new Map<string, number>();
  for (const i of indexados) for (const r of i.tf.keys()) df.set(r, (df.get(r) ?? 0) + 1);
  const promLargo = indexados.reduce((s, i) => s + i.largo, 0) / (indexados.length || 1);
  const N = indexados.length;

  return {
    buscar(consulta: string, limite = 20): Resultado[] {
      const q = consulta.trim();
      if (!q) return [];
      const ref = parseReferencia(q, leyes);
      const consultaRaices = raices(q, true);
      const raicesSet = new Set(consultaRaices);
      const frase = plegar(q);

      const puntaje = new Map<(typeof indexados)[number], number>();
      for (const i of indexados) {
        let s = 0;
        for (const r of consultaRaices) {
          const f = i.tf.get(r);
          if (!f) continue;
          const idf = Math.log(1 + (N - (df.get(r) ?? 0) + 0.5) / ((df.get(r) ?? 0) + 0.5));
          s += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * i.largo) / promLargo));
        }
        if (s > 0 && consultaRaices.length > 1 && i.plano.includes(frase)) s += 4; // la frase literal pesa más
        if (s > 0) puntaje.set(i, s);
      }

      const exactos = ref
        ? indexados.filter((i) => i.clave === ref.clave && (!ref.ley || plegar(i.doc.ley) === plegar(ref.ley)))
        : [];
      // "LISR 82 bis" pide un artículo, no los que mencionan el 82: sin más palabras, solo el exacto.
      if (ref && exactos.length > 0 && soloReferencia(q, leyes)) {
        return exactos.slice(0, limite).map((i) => ({
          ley: i.doc.ley,
          numero: i.doc.numero,
          slug: i.doc.slug,
          exacto: true,
          fragmento: fragmento(i.doc.texto, new Set()),
        }));
      }
      const porPuntaje = [...puntaje.entries()]
        .filter(([i]) => !exactos.includes(i))
        .sort((a, b) => b[1] - a[1])
        .map(([i]) => i);

      return [...exactos.map((i) => ({ i, exacto: true })), ...porPuntaje.map((i) => ({ i, exacto: false }))]
        .slice(0, limite)
        .map(({ i, exacto }) => ({
          ley: i.doc.ley,
          numero: i.doc.numero,
          slug: i.doc.slug,
          exacto,
          fragmento: fragmento(i.doc.texto, raicesSet),
        }));
    },
  };
}
