import datos from "../data/corpus.json";
import { crearBuscador, type Doc } from "./buscar";
import { slugNumero, tituloLey } from "./formato";
import type { Snapshot } from "./tipos";

const snapshot = datos as unknown as Snapshot;

export interface ArticuloVista {
  numero: string;
  slug: string;
  texto: string;
  tags: string[];
}

export interface LeyVista {
  codigo: string;
  titulo: string;
  fuenteUrl: string;
  urlDecreto: string | null;
  ultimaReforma: string | null;
  articulos: ArticuloVista[];
}

export const generadoEn = snapshot.generadoEn;

export const leyes: LeyVista[] = snapshot.leyes.map((l) => {
  const articulos = l.articulos.map((a) => ({ numero: a.numero, slug: slugNumero(a.numero), texto: a.texto, tags: a.tags }));
  // Dos artículos con el mismo slug se pisarían en la URL: mejor romper el build que servir uno por otro.
  const vistos = new Set<string>();
  for (const a of articulos) {
    if (vistos.has(a.slug)) throw new Error(`Slug repetido en ${l.codigo}: ${a.slug} (${a.numero})`);
    vistos.add(a.slug);
  }
  return {
    codigo: l.codigo,
    titulo: tituloLey(l.nombre),
    fuenteUrl: l.fuenteUrl,
    urlDecreto: l.urlDecreto,
    ultimaReforma: l.ultimaReforma,
    articulos,
  };
});

export const leyPorCodigo = (codigo: string) => leyes.find((l) => l.codigo === codigo);

export function articuloPorSlug(codigo: string, slug: string) {
  const ley = leyPorCodigo(codigo);
  const i = ley?.articulos.findIndex((a) => a.slug === slug) ?? -1;
  if (!ley || i < 0) return null;
  return { ley, articulo: ley.articulos[i]!, anterior: ley.articulos[i - 1] ?? null, siguiente: ley.articulos[i + 1] ?? null };
}

const docs: Doc[] = leyes.flatMap((l) => l.articulos.map((a) => ({ ley: l.codigo, numero: a.numero, slug: a.slug, texto: a.texto })));
export const buscador = crearBuscador(docs, leyes.map((l) => l.codigo));
