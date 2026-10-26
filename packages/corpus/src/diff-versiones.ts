import type { ArticuloParseado } from "./parse-articulos.js";

export interface CambioArticulo {
  numero: string;
  anterior: string;
  nuevo: string;
}

export interface DiffLey {
  agregados: ArticuloParseado[];
  modificados: CambioArticulo[];
  /** Artículos que ya no aparecen (derogados o renumerados): requieren revisión humana. */
  eliminados: ArticuloParseado[];
}

/** Compara espacios y saltos de línea de forma tolerante: el reformateo del PDF no es una reforma. */
const canonico = (t: string) => t.replace(/\s+/g, " ").trim();

export function diffVersiones(
  vigentes: ArticuloParseado[],
  nuevos: ArticuloParseado[],
): DiffLey {
  const porNumero = new Map(vigentes.map((a) => [a.numero, a]));
  const vistos = new Set<string>();
  const diff: DiffLey = { agregados: [], modificados: [], eliminados: [] };

  for (const nuevo of nuevos) {
    vistos.add(nuevo.numero);
    const previo = porNumero.get(nuevo.numero);
    if (!previo) {
      diff.agregados.push(nuevo);
    } else if (canonico(previo.texto) !== canonico(nuevo.texto)) {
      diff.modificados.push({
        numero: nuevo.numero,
        anterior: previo.texto,
        nuevo: nuevo.texto,
      });
    }
  }
  for (const previo of vigentes) {
    if (!vistos.has(previo.numero)) diff.eliminados.push(previo);
  }
  return diff;
}
