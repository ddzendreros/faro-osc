import { sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "./schema/index.js";

type Esquema = typeof schema;
export type TxOrg<Q extends PgQueryResultHKT> = PgTransaction<Q, Esquema, ExtractTablesWithRelations<Esquema>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ejecuta `fn` en una transacción con el contexto de una OSC fijado, de modo que las políticas
 * RLS solo dejen ver y escribir filas de esa OSC.
 *
 * `set_config(..., true)` limita el valor a la transacción, así que es seguro con pools de
 * conexiones: no se filtra a la siguiente petición que reutilice la conexión.
 *
 * Solo protege si la conexión usa el rol `faro_app`. El dueño de las tablas omite RLS.
 */
export async function conOrg<Q extends PgQueryResultHKT, T>(
  db: PgDatabase<Q, Esquema>,
  orgId: string,
  fn: (tx: TxOrg<Q>) => Promise<T>,
): Promise<T> {
  if (!UUID.test(orgId)) throw new Error("orgId inválido: se esperaba un UUID");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return fn(tx);
  });
}
