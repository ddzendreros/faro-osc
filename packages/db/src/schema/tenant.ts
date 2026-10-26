import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { aislarPorOrg, EMBEDDING_DIMS } from "./comun.js";
import { articulos, reformas } from "./corpus.js";

/* Todo lo de esta sección es privado de cada OSC y queda bajo RLS (ver aislarPorOrg). */

/** Global (no por-OSC): el inicio de sesión ocurre antes de saber a qué OSC pertenece la persona. */
export const usuarios = pgTable("usuarios", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  nombre: text(),
  esAdminPlataforma: boolean().notNull().default(false),
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const organizaciones = pgTable("organizaciones", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull(),
  figuraJuridica: text().notNull(),
  /** Entidad federativa del domicilio (define qué leyes estatales aplican en el futuro). */
  entidad: text(),
  /** Fracciones/actividades del art. 79 LISR que realiza; alimenta el cruce de reformas. */
  actividadesArt79: text().array().notNull().default(sql`'{}'::text[]`),
  esDonataria: boolean().notNull().default(false),
  cluni: text(),
  rangoIngresos: text(),
  /** Instrucciones propias que se inyectan al agente. */
  instrucciones: text(),
  guardarConversaciones: boolean().notNull().default(true),
  creadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("org_figura_valida", sql`${t.figuraJuridica} in ('AC', 'IAP', 'SC', 'ABP', 'otra')`),
  aislarPorOrg("organizaciones", "id"),
]).enableRLS();

export const miembros = pgTable("miembros", {
  orgId: uuid().notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
  usuarioId: uuid().notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  rol: text().notNull().default("miembro"),
}, (t) => [
  primaryKey({ columns: [t.orgId, t.usuarioId] }),
  check("miembros_rol_valido", sql`${t.rol} in ('admin_osc', 'miembro')`),
  aislarPorOrg("miembros"),
]).enableRLS();

export const documentosOsc = pgTable("documentos_osc", {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
  nombre: text().notNull(),
  /** 'acta_constitutiva', 'estatutos', 'autorizacion_sat', 'otro'… */
  tipo: text().notNull().default("otro"),
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documentos_osc_org_idx").on(t.orgId), aislarPorOrg("documentos_osc")]).enableRLS();

export const fragmentosOsc = pgTable("fragmentos_osc", {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
  documentoId: uuid().notNull().references(() => documentosOsc.id, { onDelete: "cascade" }),
  orden: integer().notNull(),
  texto: text().notNull(),
  embedding: vector({ dimensions: EMBEDDING_DIMS }),
  embeddingModelo: text(),
}, (t) => [
  unique("fragmentos_doc_orden_uq").on(t.documentoId, t.orden),
  index("fragmentos_osc_org_idx").on(t.orgId),
  index("fragmentos_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  aislarPorOrg("fragmentos_osc"),
]).enableRLS();

export const conversaciones = pgTable("conversaciones", {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
  usuarioId: uuid().references(() => usuarios.id, { onDelete: "set null" }),
  titulo: text(),
  creadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("conversaciones_org_idx").on(t.orgId, t.creadaEn), aislarPorOrg("conversaciones")]).enableRLS();

export const mensajes = pgTable("mensajes", {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
  conversacionId: uuid().notNull().references(() => conversaciones.id, { onDelete: "cascade" }),
  rol: text().notNull(),
  contenido: text().notNull(),
  /** [{ leyId, numero, articuloId, vigenteAl }] — las citas ya validadas contra el corpus. */
  citas: jsonb().notNull().default(sql`'[]'::jsonb`),
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("mensajes_rol_valido", sql`${t.rol} in ('user', 'assistant')`),
  index("mensajes_conversacion_idx").on(t.conversacionId, t.creadoEn),
  aislarPorOrg("mensajes"),
]).enableRLS();

export const alertas = pgTable("alertas", {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
  reformaId: uuid().notNull().references(() => reformas.id),
  /** Versiones nuevas de artículos que tocan el perfil de esta OSC. */
  articulosAfectados: uuid().array().notNull().default(sql`'{}'::uuid[]`),
  leida: boolean().notNull().default(false),
  creadaEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Una reforma alerta una sola vez a cada OSC: el worker puede reintentar sin duplicar.
  unique("alertas_org_reforma_uq").on(t.orgId, t.reformaId),
  aislarPorOrg("alertas"),
]).enableRLS();

export const preferenciasDigest = pgTable("preferencias_digest", {
  orgId: uuid().primaryKey().references(() => organizaciones.id, { onDelete: "cascade" }),
  activo: boolean().notNull().default(true),
  /** 1 = lunes … 7 = domingo. */
  dia: integer().notNull().default(1),
  destinatarios: text().array().notNull().default(sql`'{}'::text[]`),
  /** Secciones incluidas: 'reformas', 'iniciativas', 'noticias'. */
  secciones: text().array().notNull().default(sql`'{reformas,iniciativas,noticias}'::text[]`),
}, (t) => [
  check("pref_digest_dia_valido", sql`${t.dia} between 1 and 7`),
  aislarPorOrg("preferencias_digest"),
]).enableRLS();

export const digests = pgTable("digests", {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid().notNull().references(() => organizaciones.id, { onDelete: "cascade" }),
  /** Lunes de la semana que cubre. */
  semana: date({ mode: "string" }).notNull(),
  contenido: text().notNull(),
  /** [{ tipo: 'reforma'|'iniciativa'|'noticia', refId, url }] — toda afirmación enlaza a su fuente. */
  items: jsonb().notNull().default(sql`'[]'::jsonb`),
  enviadoEn: timestamp({ withTimezone: true }),
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Un digest por OSC y semana: reintentar el job semanal no duplica envíos.
  unique("digests_org_semana_uq").on(t.orgId, t.semana),
  aislarPorOrg("digests"),
]).enableRLS();
