import { sql, type SQL } from "drizzle-orm";
import { customType, pgPolicy } from "drizzle-orm/pg-core";

/**
 * Dimensión de los embeddings (bge-m3 local = 1024). Cambiar de modelo con otra dimensión
 * exige una migración y reindexar; por eso cada fila guarda también `embedding_modelo`.
 */
export const EMBEDDING_DIMS = 1024;

/** Rol con el que se conecta la app web: sujeto a RLS. El dueño de las tablas (worker, migraciones) lo omite. */
export const ROL_APP = "faro_app";

export const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

/**
 * Contexto de tenant: la app lo fija por transacción con `set_config('app.org_id', …, true)`.
 * `nullif` evita el error de `''::uuid` cuando la variable ya existe pero quedó vacía.
 */
const ORG_ACTUAL = "nullif(current_setting('app.org_id', true), '')::uuid";

/** Política de aislamiento: una fila solo es visible/escribible si pertenece a la OSC del contexto. */
export function aislarPorOrg(tabla: string, columna = "org_id") {
  const expr: SQL = sql.raw(`${columna} = ${ORG_ACTUAL}`);
  return pgPolicy(`${tabla}_aislamiento_org`, {
    as: "permissive",
    to: ROL_APP,
    for: "all",
    using: expr,
    withCheck: expr,
  });
}
