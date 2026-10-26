import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index.js";

const DIR_MIGRACIONES = new URL("../drizzle/", import.meta.url);

/**
 * Único desvío respecto a producción: PGlite no trae pgvector, así que las columnas `vector(N)` se
 * crean como `text` y se omiten la extensión y los índices HNSW. Todo lo demás (RLS, roles,
 * permisos, exclusión de traslapes, tsvector generado, checks) se ejecuta tal cual.
 */
function adaptarParaPglite(statement: string): string | null {
  if (/CREATE EXTENSION IF NOT EXISTS vector/i.test(statement)) return null;
  if (/USING hnsw/i.test(statement)) return null;
  return statement.replace(/vector\(\d+\)/g, "text");
}

export async function crearBaseDePrueba() {
  const pg = new PGlite({ extensions: { btree_gist } });
  const archivos = readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith(".sql")).sort();
  for (const archivo of archivos) {
    const sql = readFileSync(new URL(archivo, DIR_MIGRACIONES), "utf8");
    for (const raw of sql.split("--> statement-breakpoint")) {
      const statement = adaptarParaPglite(raw.trim());
      if (statement) await pg.exec(statement);
    }
  }
  return { pg, db: drizzle(pg, { schema, casing: "snake_case" }) };
}

/** Mensaje de error de Postgres detrás del envoltorio de Drizzle. */
export async function mensajeDeError(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (e) {
    const causa = (e as { cause?: { message?: string } }).cause;
    return causa?.message ?? (e as Error).message;
  }
  throw new Error("Se esperaba un error y no hubo ninguno");
}
