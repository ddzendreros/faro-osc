import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { EMBEDDING_DIMS, ROL_APP, tsvector } from "./comun.js";

/* El corpus es global y de solo lectura para la app: lo escriben el worker y las migraciones. */

export const leyes = pgTable("leyes", {
  id: uuid().primaryKey().defaultRandom(),
  /** Nombre del PDF en Diputados ("LFFAOSC"; a veces numérico, "79"). Único entre leyes federales. */
  codigo: text().notNull().unique(),
  nombre: text().notNull(),
  abreviatura: text().notNull(),
  ambito: text().notNull().default("federal"),
  /** Entidad federativa si ambito = 'estatal'. */
  entidad: text(),
  fuenteUrl: text().notNull(),
  /** Fecha de última reforma que ya procesamos; el worker la compara con el índice de Diputados. */
  ultimaReformaDof: date({ mode: "string" }),
  /** Hash del texto limpio vigente: si no cambia, no hay nada que diffear. */
  textoSha256: text(),
  actualizadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("leyes_ambito_valido", sql`${t.ambito} in ('federal', 'estatal')`)]);

export const reformas = pgTable("reformas", {
  id: uuid().primaryKey().defaultRandom(),
  leyId: uuid().notNull().references(() => leyes.id),
  fechaDof: date({ mode: "string" }).notNull(),
  urlDof: text(),
  /** Resumen en lenguaje llano generado por el LLM, revisado antes de publicarse. */
  resumen: text(),
  /** { agregados: [...], modificados: [...], eliminados: [...] } de @faro/corpus diffVersiones. */
  diff: jsonb(),
  /** Cola de revisión: nada se publica sin aprobación humana. */
  estado: text().notNull().default("pendiente"),
  revisadaPor: uuid(),
  revisadaEn: timestamp({ withTimezone: true }),
  creadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("reformas_estado_valido", sql`${t.estado} in ('pendiente', 'aprobada', 'rechazada')`),
  index("reformas_ley_fecha_idx").on(t.leyId, t.fechaDof),
  pgPolicy("reformas_solo_aprobadas", { as: "permissive", to: ROL_APP, for: "select", using: sql`estado = 'aprobada'` }),
]).enableRLS();

/**
 * Cada fila es una *versión* de un artículo, vigente en el intervalo [vigente_desde, vigente_hasta).
 * `vigente_hasta` nulo = sigue vigente. El mismo artículo no puede tener dos versiones publicadas
 * que se traslapen en el tiempo (constraint de exclusión en la migración SQL, que Drizzle no expresa).
 */
export const articulos = pgTable("articulos", {
  id: uuid().primaryKey().defaultRandom(),
  leyId: uuid().notNull().references(() => leyes.id),
  /** Clave canónica de @faro/corpus: "82", "82 Bis", "4o-A". */
  numero: text().notNull(),
  texto: text().notNull(),
  textoSha256: text().notNull(),
  vigenteDesde: date({ mode: "string" }).notNull(),
  vigenteHasta: date({ mode: "string" }),
  /** Reforma que introdujo esta versión; nulo en la carga inicial. */
  reformaId: uuid().references(() => reformas.id),
  /** 'pendiente' hasta que la reforma se aprueba; la app solo lee 'publicado'. */
  estado: text().notNull().default("publicado"),
  /** Para cruzar con el perfil de la OSC: 'donataria', 'asistencial', 'antilavado'… */
  tags: text().array().notNull().default(sql`'{}'::text[]`),
  embedding: vector({ dimensions: EMBEDDING_DIMS }),
  embeddingModelo: text(),
  busqueda: tsvector().generatedAlwaysAs(sql`to_tsvector('spanish', texto)`),
}, (t) => [
  check("articulos_estado_valido", sql`${t.estado} in ('pendiente', 'publicado', 'rechazado')`),
  check("articulos_intervalo_valido", sql`${t.vigenteHasta} is null or ${t.vigenteHasta} > ${t.vigenteDesde}`),
  index("articulos_ley_numero_idx").on(t.leyId, t.numero),
  index("articulos_busqueda_idx").using("gin", t.busqueda),
  index("articulos_tags_idx").using("gin", t.tags),
  index("articulos_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  pgPolicy("articulos_solo_publicados", { as: "permissive", to: ROL_APP, for: "select", using: sql`estado = 'publicado'` }),
]).enableRLS();

export const fuentesNoticias = pgTable("fuentes_noticias", {
  id: uuid().primaryKey().defaultRandom(),
  tipo: text().notNull(),
  nombre: text().notNull(),
  url: text().notNull().unique(),
  activa: boolean().notNull().default(true),
}, (t) => [check("fuentes_tipo_valido", sql`${t.tipo} in ('dof', 'sat', 'gaceta', 'rss')`)]);

export const noticias = pgTable("noticias", {
  id: uuid().primaryKey().defaultRandom(),
  fuenteId: uuid().notNull().references(() => fuentesNoticias.id),
  titulo: text().notNull(),
  /** Único: así la ingesta diaria es idempotente y no duplica. */
  url: text().notNull().unique(),
  fecha: date({ mode: "string" }).notNull(),
  resumen: text(),
  tags: text().array().notNull().default(sql`'{}'::text[]`),
  /** Iniciativa en trámite: "propuesta, aún no es ley". */
  esIniciativa: boolean().notNull().default(false),
  creadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("noticias_fecha_idx").on(t.fecha),
  index("noticias_tags_idx").using("gin", t.tags),
]);
