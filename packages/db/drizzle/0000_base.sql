-- Extensiones y rol de la app. Va primero: las políticas RLS de las tablas hacen referencia a faro_app.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- La app web se conecta como faro_app (sujeta a RLS). El dueño de las tablas, que usan las
-- migraciones y el worker, omite RLS. NOLOGIN: quien despliega le asigna LOGIN y contraseña.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'faro_app') THEN
    CREATE ROLE faro_app NOLOGIN;
  END IF;
END
$$;
