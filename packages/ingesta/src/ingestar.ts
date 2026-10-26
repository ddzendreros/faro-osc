import { diffVersiones, etiquetarArticulo, huellaArticulo, type ArticuloParseado } from "@faro/corpus";
import { schema } from "@faro/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";

const { leyes, reformas, articulos } = schema;

type Esquema = typeof schema;
export type Db<Q extends PgQueryResultHKT = PgQueryResultHKT> = PgDatabase<Q, Esquema>;
export type Tx<Q extends PgQueryResultHKT = PgQueryResultHKT> = PgTransaction<
  Q,
  Esquema,
  ExtractTablesWithRelations<Esquema>
>;

export interface EntradaLey {
  codigo: string;
  nombre: string;
  abreviatura: string;
  fuenteUrl: string;
  /**
   * Fecha (YYYY-MM-DD) desde la que rige este texto: la de la última reforma en el DOF.
   * En la carga inicial NO se usa la fecha de publicación original: el texto consolidado que
   * tenemos solo se sabe vigente desde la última reforma, y de antes no tenemos versión.
   */
  fechaVigencia: string;
  articulos: ArticuloParseado[];
  /**
   * Decreto de la reforma (PDF oficial) para que quien revise pueda ir a la fuente. Es opcional:
   * no bloquea la ingesta si no se encuentra.
   */
  urlReforma?: string;
  /** Hash del texto limpio completo (de @faro/corpus procesarPdfLey). */
  textoSha256: string;
}

export type ResultadoIngesta =
  | { tipo: "carga_inicial"; articulos: number }
  /** El texto es idéntico al de la última ingesta. */
  | { tipo: "sin_cambios" }
  /** El hash cambió pero ningún artículo lo hizo (p. ej. paginación o espaciado del PDF). */
  | { tipo: "sin_cambios_de_fondo" }
  | { tipo: "reforma_pendiente"; reformaId: string; agregados: number; modificados: number; eliminados: number };

/** Inserta en lotes para no rebasar el límite de parámetros del protocolo de Postgres. */
async function insertarPorLotes<T>(filas: T[], insertar: (lote: T[]) => Promise<unknown>, tamano = 200) {
  for (let i = 0; i < filas.length; i += tamano) await insertar(filas.slice(i, i + tamano));
}

/**
 * Lleva a la base el texto de una ley. Debe ejecutarse con la conexión privilegiada (la del dueño
 * de las tablas), no con `faro_app`: el corpus es de solo lectura para la app.
 *
 * - Primera vez: publica todos los artículos.
 * - Después: nada se publica solo. Una diferencia real crea una reforma `pendiente` con versiones
 *   `pendiente`; la vigencia no cambia hasta que `aprobarReforma` la apruebe.
 */
export async function ingestarLey<Q extends PgQueryResultHKT>(db: Db<Q>, e: EntradaLey): Promise<ResultadoIngesta> {
  return db.transaction(async (tx) => {
    await tx
      .insert(leyes)
      .values({ codigo: e.codigo, nombre: e.nombre, abreviatura: e.abreviatura, fuenteUrl: e.fuenteUrl })
      .onConflictDoNothing({ target: leyes.codigo });
    // El bloqueo de fila serializa ingestas concurrentes de la misma ley.
    const [ley] = await tx.select().from(leyes).where(eq(leyes.codigo, e.codigo)).for("update");
    if (!ley) throw new Error(`No se pudo crear la ley ${e.codigo}`);

    if (ley.textoSha256 === e.textoSha256) return { tipo: "sin_cambios" };

    const marcarProcesada = () =>
      tx
        .update(leyes)
        .set({ nombre: e.nombre, textoSha256: e.textoSha256, ultimaReformaDof: e.fechaVigencia, actualizadaEn: new Date() })
        .where(eq(leyes.id, ley.id));

    const vigentes = await tx
      .select({ numero: articulos.numero, texto: articulos.texto })
      .from(articulos)
      .where(and(eq(articulos.leyId, ley.id), eq(articulos.estado, "publicado"), isNull(articulos.vigenteHasta)));

    if (vigentes.length === 0) {
      await insertarPorLotes(e.articulos, (lote) =>
        tx.insert(articulos).values(
          lote.map((a) => ({
            leyId: ley.id,
            numero: a.numero,
            texto: a.texto,
            textoSha256: huellaArticulo(a.texto),
            vigenteDesde: e.fechaVigencia,
            tags: etiquetarArticulo(e.codigo, a.texto),
          })),
        ),
      );
      await marcarProcesada();
      return { tipo: "carga_inicial", articulos: e.articulos.length };
    }

    const diff = diffVersiones(vigentes, e.articulos);
    if (!diff.agregados.length && !diff.modificados.length && !diff.eliminados.length) {
      await marcarProcesada();
      return { tipo: "sin_cambios_de_fondo" };
    }

    // El texto de Diputados es consolidado: esta reforma ya incluye a cualquier pendiente anterior.
    const previas = await tx
      .select({ id: reformas.id })
      .from(reformas)
      .where(and(eq(reformas.leyId, ley.id), eq(reformas.estado, "pendiente")));
    if (previas.length) {
      const ids = previas.map((r) => r.id);
      await tx.update(reformas).set({ estado: "rechazada", revisadaEn: new Date() }).where(inArray(reformas.id, ids));
      await tx
        .update(articulos)
        .set({ estado: "rechazado" })
        .where(and(inArray(articulos.reformaId, ids), eq(articulos.estado, "pendiente")));
    }

    const [reforma] = await tx
      .insert(reformas)
      .values({ leyId: ley.id, fechaDof: e.fechaVigencia, urlDof: e.urlReforma ?? null, diff })
      .returning({ id: reformas.id });
    if (!reforma) throw new Error("No se pudo crear la reforma");

    const nuevas = [...diff.agregados, ...diff.modificados.map((m) => ({ numero: m.numero, texto: m.nuevo }))];
    await insertarPorLotes(nuevas, (lote) =>
      tx.insert(articulos).values(
        lote.map((a) => ({
          leyId: ley.id,
          numero: a.numero,
          texto: a.texto,
          textoSha256: huellaArticulo(a.texto),
          vigenteDesde: e.fechaVigencia,
          estado: "pendiente",
          reformaId: reforma.id,
          tags: etiquetarArticulo(e.codigo, a.texto),
        })),
      ),
    );
    await marcarProcesada();
    return {
      tipo: "reforma_pendiente",
      reformaId: reforma.id,
      agregados: diff.agregados.length,
      modificados: diff.modificados.length,
      eliminados: diff.eliminados.length,
    };
  });
}
