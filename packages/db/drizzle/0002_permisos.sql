-- Permisos mínimos de faro_app. Lo que no aparece aquí (p. ej. la tabla usuarios, que es global y
-- sin RLS) no es accesible para la app: el inicio de sesión usa la conexión privilegiada.
GRANT USAGE ON SCHEMA public TO faro_app;
--> statement-breakpoint
GRANT SELECT ON leyes, reformas, articulos, fuentes_noticias, noticias TO faro_app;
--> statement-breakpoint
GRANT SELECT, UPDATE ON organizaciones TO faro_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON miembros, documentos_osc, fragmentos_osc, conversaciones, mensajes TO faro_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON preferencias_digest TO faro_app;
--> statement-breakpoint
GRANT SELECT, UPDATE ON alertas TO faro_app;
--> statement-breakpoint
-- El digest y las alertas las crea el worker; la app solo lee (y marca alertas como leídas).
GRANT SELECT ON digests TO faro_app;
--> statement-breakpoint
-- Una misma ley+artículo no puede tener dos versiones publicadas con vigencias que se traslapan.
-- Los intervalos son [vigente_desde, vigente_hasta); vigente_hasta nulo = abierto.
ALTER TABLE articulos ADD CONSTRAINT articulos_sin_traslape
  EXCLUDE USING gist (ley_id WITH =, numero WITH =, daterange(vigente_desde, vigente_hasta, '[)') WITH &&)
  WHERE (estado = 'publicado');
