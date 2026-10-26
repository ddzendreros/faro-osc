CREATE TABLE "articulos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ley_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"texto" text NOT NULL,
	"texto_sha256" text NOT NULL,
	"vigente_desde" date NOT NULL,
	"vigente_hasta" date,
	"reforma_id" uuid,
	"estado" text DEFAULT 'publicado' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"embedding" vector(1024),
	"embedding_modelo" text,
	"busqueda" "tsvector" GENERATED ALWAYS AS (to_tsvector('spanish', texto)) STORED,
	CONSTRAINT "articulos_estado_valido" CHECK ("articulos"."estado" in ('pendiente', 'publicado', 'rechazado')),
	CONSTRAINT "articulos_intervalo_valido" CHECK ("articulos"."vigente_hasta" is null or "articulos"."vigente_hasta" > "articulos"."vigente_desde")
);
--> statement-breakpoint
ALTER TABLE "articulos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fuentes_noticias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"nombre" text NOT NULL,
	"url" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fuentes_noticias_url_unique" UNIQUE("url"),
	CONSTRAINT "fuentes_tipo_valido" CHECK ("fuentes_noticias"."tipo" in ('dof', 'sat', 'gaceta', 'rss'))
);
--> statement-breakpoint
CREATE TABLE "leyes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"abreviatura" text NOT NULL,
	"ambito" text DEFAULT 'federal' NOT NULL,
	"entidad" text,
	"fuente_url" text NOT NULL,
	"ultima_reforma_dof" date,
	"texto_sha256" text,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leyes_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "leyes_ambito_valido" CHECK ("leyes"."ambito" in ('federal', 'estatal'))
);
--> statement-breakpoint
CREATE TABLE "noticias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fuente_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"url" text NOT NULL,
	"fecha" date NOT NULL,
	"resumen" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"es_iniciativa" boolean DEFAULT false NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "noticias_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "reformas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ley_id" uuid NOT NULL,
	"fecha_dof" date NOT NULL,
	"url_dof" text,
	"resumen" text,
	"diff" jsonb,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"revisada_por" uuid,
	"revisada_en" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reformas_estado_valido" CHECK ("reformas"."estado" in ('pendiente', 'aprobada', 'rechazada'))
);
--> statement-breakpoint
ALTER TABLE "reformas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "alertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"reforma_id" uuid NOT NULL,
	"articulos_afectados" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"leida" boolean DEFAULT false NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alertas_org_reforma_uq" UNIQUE("org_id","reforma_id")
);
--> statement-breakpoint
ALTER TABLE "alertas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"usuario_id" uuid,
	"titulo" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"semana" date NOT NULL,
	"contenido" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enviado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digests_org_semana_uq" UNIQUE("org_id","semana")
);
--> statement-breakpoint
ALTER TABLE "digests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documentos_osc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text DEFAULT 'otro' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documentos_osc" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fragmentos_osc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"documento_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"texto" text NOT NULL,
	"embedding" vector(1024),
	"embedding_modelo" text,
	CONSTRAINT "fragmentos_doc_orden_uq" UNIQUE("documento_id","orden")
);
--> statement-breakpoint
ALTER TABLE "fragmentos_osc" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mensajes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"conversacion_id" uuid NOT NULL,
	"rol" text NOT NULL,
	"contenido" text NOT NULL,
	"citas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensajes_rol_valido" CHECK ("mensajes"."rol" in ('user', 'assistant'))
);
--> statement-breakpoint
ALTER TABLE "mensajes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "miembros" (
	"org_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"rol" text DEFAULT 'miembro' NOT NULL,
	CONSTRAINT "miembros_org_id_usuario_id_pk" PRIMARY KEY("org_id","usuario_id"),
	CONSTRAINT "miembros_rol_valido" CHECK ("miembros"."rol" in ('admin_osc', 'miembro'))
);
--> statement-breakpoint
ALTER TABLE "miembros" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"figura_juridica" text NOT NULL,
	"entidad" text,
	"actividades_art79" text[] DEFAULT '{}'::text[] NOT NULL,
	"es_donataria" boolean DEFAULT false NOT NULL,
	"cluni" text,
	"rango_ingresos" text,
	"instrucciones" text,
	"guardar_conversaciones" boolean DEFAULT true NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_figura_valida" CHECK ("organizaciones"."figura_juridica" in ('AC', 'IAP', 'SC', 'ABP', 'otra'))
);
--> statement-breakpoint
ALTER TABLE "organizaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "preferencias_digest" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"dia" integer DEFAULT 1 NOT NULL,
	"destinatarios" text[] DEFAULT '{}'::text[] NOT NULL,
	"secciones" text[] DEFAULT '{reformas,iniciativas,noticias}'::text[] NOT NULL,
	CONSTRAINT "pref_digest_dia_valido" CHECK ("preferencias_digest"."dia" between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "preferencias_digest" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nombre" text,
	"es_admin_plataforma" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_ley_id_leyes_id_fk" FOREIGN KEY ("ley_id") REFERENCES "public"."leyes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_reforma_id_reformas_id_fk" FOREIGN KEY ("reforma_id") REFERENCES "public"."reformas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noticias" ADD CONSTRAINT "noticias_fuente_id_fuentes_noticias_id_fk" FOREIGN KEY ("fuente_id") REFERENCES "public"."fuentes_noticias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reformas" ADD CONSTRAINT "reformas_ley_id_leyes_id_fk" FOREIGN KEY ("ley_id") REFERENCES "public"."leyes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_reforma_id_reformas_id_fk" FOREIGN KEY ("reforma_id") REFERENCES "public"."reformas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_osc" ADD CONSTRAINT "documentos_osc_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragmentos_osc" ADD CONSTRAINT "fragmentos_osc_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragmentos_osc" ADD CONSTRAINT "fragmentos_osc_documento_id_documentos_osc_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos_osc"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_conversacion_id_conversaciones_id_fk" FOREIGN KEY ("conversacion_id") REFERENCES "public"."conversaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencias_digest" ADD CONSTRAINT "preferencias_digest_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articulos_ley_numero_idx" ON "articulos" USING btree ("ley_id","numero");--> statement-breakpoint
CREATE INDEX "articulos_busqueda_idx" ON "articulos" USING gin ("busqueda");--> statement-breakpoint
CREATE INDEX "articulos_tags_idx" ON "articulos" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "articulos_embedding_idx" ON "articulos" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "noticias_fecha_idx" ON "noticias" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "noticias_tags_idx" ON "noticias" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "reformas_ley_fecha_idx" ON "reformas" USING btree ("ley_id","fecha_dof");--> statement-breakpoint
CREATE INDEX "conversaciones_org_idx" ON "conversaciones" USING btree ("org_id","creada_en");--> statement-breakpoint
CREATE INDEX "documentos_osc_org_idx" ON "documentos_osc" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fragmentos_osc_org_idx" ON "fragmentos_osc" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fragmentos_embedding_idx" ON "fragmentos_osc" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "mensajes_conversacion_idx" ON "mensajes" USING btree ("conversacion_id","creado_en");--> statement-breakpoint
CREATE POLICY "articulos_solo_publicados" ON "articulos" AS PERMISSIVE FOR SELECT TO "faro_app" USING (estado = 'publicado');--> statement-breakpoint
CREATE POLICY "reformas_solo_aprobadas" ON "reformas" AS PERMISSIVE FOR SELECT TO "faro_app" USING (estado = 'aprobada');--> statement-breakpoint
CREATE POLICY "alertas_aislamiento_org" ON "alertas" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "conversaciones_aislamiento_org" ON "conversaciones" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "digests_aislamiento_org" ON "digests" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "documentos_osc_aislamiento_org" ON "documentos_osc" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "fragmentos_osc_aislamiento_org" ON "fragmentos_osc" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "mensajes_aislamiento_org" ON "mensajes" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "miembros_aislamiento_org" ON "miembros" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "organizaciones_aislamiento_org" ON "organizaciones" AS PERMISSIVE FOR ALL TO "faro_app" USING (id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.org_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "preferencias_digest_aislamiento_org" ON "preferencias_digest" AS PERMISSIVE FOR ALL TO "faro_app" USING (org_id = nullif(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);