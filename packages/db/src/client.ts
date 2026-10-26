import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Conexión a Postgres. La app web debe usar una URL del rol `faro_app` (sujeto a RLS); el worker y
 * las migraciones usan la del dueño de las tablas.
 */
export function crearDb(url: string) {
  const cliente = postgres(url);
  return {
    db: drizzle(cliente, { schema, casing: "snake_case" }),
    cerrar: () => cliente.end(),
  };
}
