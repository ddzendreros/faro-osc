import { schema } from "@faro/db";
import { and, eq, isNull } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Db, Tx } from "./ingestar.js";

const { reformas, articulos } = schema;

export interface ResultadoAprobacion {
  publicados: number;
  retirados: number;
}

/**
 * Quita de la vigencia la versión publicada actual de un artículo a partir de `fecha`.
 * Si esa versión rige desde la misma fecha o después, no hay intervalo posible que cerrar: se trata
 * de la corrección de un texto con la misma fecha (p. ej. una fe de erratas en el PDF) y la versión
 * anterior queda descartada en lugar de cerrada.
 */
async function retirarVigente<Q extends PgQueryResultHKT>(tx: Tx<Q>, leyId: string, numero: string, fecha: string) {
  const [previa] = await tx
    .select({ id: articulos.id, vigenteDesde: articulos.vigenteDesde })
    .from(articulos)
    .where(
      and(
        eq(articulos.leyId, leyId),
        eq(articulos.numero, numero),
        eq(articulos.estado, "publicado"),
        isNull(articulos.vigenteHasta),
      ),
    );
  if (!previa) return 0;
  const cambio = previa.vigenteDesde < fecha ? { vigenteHasta: fecha } : { estado: "rechazado" };
  await tx.update(articulos).set(cambio).where(eq(articulos.id, previa.id));
  return 1;
}

async function reformaPendiente<Q extends PgQueryResultHKT>(tx: Tx<Q>, reformaId: string) {
  const [reforma] = await tx.select().from(reformas).where(eq(reformas.id, reformaId)).for("update");
  if (!reforma) throw new Error(`No existe la reforma ${reformaId}`);
  if (reforma.estado !== "pendiente") {
    throw new Error(`La reforma ${reformaId} no está pendiente (estado: ${reforma.estado})`);
  }
  return reforma;
}

/**
 * Publica una reforma: cierra la versión vigente de cada artículo que cambió o desapareció y
 * activa las nuevas, todo en una transacción. Las consultas por fecha empiezan a ver la reforma
 * desde su `fecha_dof`.
 */
export async function aprobarReforma<Q extends PgQueryResultHKT>(
  db: Db<Q>,
  reformaId: string,
  revisadaPor?: string,
): Promise<ResultadoAprobacion> {
  return db.transaction(async (tx) => {
    const reforma = await reformaPendiente(tx, reformaId);
    const nuevas = await tx
      .select({ numero: articulos.numero, vigenteDesde: articulos.vigenteDesde })
      .from(articulos)
      .where(and(eq(articulos.reformaId, reformaId), eq(articulos.estado, "pendiente")));

    let retirados = 0;
    // Primero se cierran las versiones anteriores: la base no admite dos publicadas que se traslapen.
    for (const n of nuevas) retirados += await retirarVigente(tx, reforma.leyId, n.numero, n.vigenteDesde);
    const eliminados = (reforma.diff as { eliminados?: { numero: string }[] } | null)?.eliminados ?? [];
    for (const e of eliminados) retirados += await retirarVigente(tx, reforma.leyId, e.numero, reforma.fechaDof);

    await tx
      .update(articulos)
      .set({ estado: "publicado" })
      .where(and(eq(articulos.reformaId, reformaId), eq(articulos.estado, "pendiente")));
    await tx
      .update(reformas)
      .set({ estado: "aprobada", revisadaPor: revisadaPor ?? null, revisadaEn: new Date() })
      .where(eq(reformas.id, reformaId));
    return { publicados: nuevas.length, retirados };
  });
}

/** Descarta una reforma pendiente: la vigencia queda como estaba. */
export async function rechazarReforma<Q extends PgQueryResultHKT>(
  db: Db<Q>,
  reformaId: string,
  revisadaPor?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await reformaPendiente(tx, reformaId);
    await tx
      .update(articulos)
      .set({ estado: "rechazado" })
      .where(and(eq(articulos.reformaId, reformaId), eq(articulos.estado, "pendiente")));
    await tx
      .update(reformas)
      .set({ estado: "rechazada", revisadaPor: revisadaPor ?? null, revisadaEn: new Date() })
      .where(eq(reformas.id, reformaId));
  });
}
