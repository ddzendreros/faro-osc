import { EMBEDDING_DIMS, schema } from "@faro/db";
import type { ProveedorEmbeddings } from "@faro/providers";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Db } from "./ingestar.js";

const { articulos, leyes } = schema;

// Margen de seguridad frente al contexto del modelo; ningún artículo real se acerca a este tamaño.
const MAX_CARACTERES = 24_000;

/**
 * Genera el embedding de los artículos publicados que no lo tienen o que se calcularon con otro
 * modelo (así cambiar de modelo reindexa solo, sin borrar nada a mano). Los artículos pendientes de
 * aprobación no se procesan: aún no son consultables. Corre de nuevo después de aprobar una reforma.
 *
 * Devuelve cuántos artículos procesó. Es seguro interrumpirlo y reanudarlo.
 */
export async function embeberPendientes<Q extends PgQueryResultHKT>(
  db: Db<Q>,
  proveedor: ProveedorEmbeddings,
  opciones: { lote?: number } = {},
): Promise<number> {
  if (proveedor.dimensiones !== EMBEDDING_DIMS) {
    throw new Error(
      `El proveedor produce ${proveedor.dimensiones} dimensiones y el esquema usa ${EMBEDDING_DIMS}; cambiar de dimensión requiere una migración`,
    );
  }
  const lote = opciones.lote ?? 32;
  let total = 0;
  for (;;) {
    const filas = await db
      .select({ id: articulos.id, numero: articulos.numero, texto: articulos.texto, ley: leyes.abreviatura })
      .from(articulos)
      .innerJoin(leyes, eq(leyes.id, articulos.leyId))
      .where(
        and(
          eq(articulos.estado, "publicado"),
          or(isNull(articulos.embedding), isNull(articulos.embeddingModelo), ne(articulos.embeddingModelo, proveedor.modelo)),
        ),
      )
      .limit(lote);
    if (filas.length === 0) return total;

    // Se antepone la cita: ayuda a que "LISR 82" encuentre el artículo, no solo su contenido.
    const vectores = await proveedor.embeber(
      filas.map((f) => `${f.ley} art. ${f.numero}\n${f.texto}`.slice(0, MAX_CARACTERES)),
    );
    await db.transaction(async (tx) => {
      for (const [i, f] of filas.entries()) {
        await tx
          .update(articulos)
          .set({ embedding: vectores[i], embeddingModelo: proveedor.modelo })
          .where(eq(articulos.id, f.id));
      }
    });
    total += filas.length;
  }
}
