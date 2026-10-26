import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  // Los nombres de columna en el esquema van en camelCase; en SQL, en snake_case.
  casing: "snake_case",
});
