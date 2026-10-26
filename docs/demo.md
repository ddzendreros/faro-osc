# Demo en Vercel: plan por etapas

La demo vive en `apps/web` (Next.js). Cada etapa se puede desplegar por separado; cada una añade una
dependencia externa, así que conviene decidir antes quién la paga o la administra.

## Etapa 0: visor del corpus (hecha)

Estática y sin secretos. Lee un snapshot del texto oficial (`apps/web/data/corpus.json`), que genera
`corpus exportar` a partir de los PDF de la Cámara de Diputados.

- Busca por palabras clave (BM25 sobre raíces, sin acentos) o por referencia directa ("LISR 82 Bis").
- Una página por artículo, con su cita y la fecha del texto, lista para copiar.
- Lo que **no** hace: responder preguntas, personalizar, avisar de reformas, mostrar versiones anteriores.

En línea: https://faro-osc-demo.vercel.app (proyecto `faro-osc-demo` en Vercel). Se despliega a mano con
la CLI; el proyecto no está conectado a GitHub, así que un `git push` no lo actualiza por sí solo.

Actualizar el texto y volver a desplegar:

```
pnpm --filter @faro/corpus build
node packages/corpus/dist/cli.js exportar apps/web/data/corpus.json
cd apps/web && vercel --prod
```

El snapshot es un archivo fijo: si Diputados publica una reforma, la demo no la ve hasta que se regenere.
Un cron diario que compare la fecha de última reforma del índice y avise sería la mitad de la etapa 3.

## Etapa 1: agente que responde con citas

Añade una ruta `POST /api/preguntar` que recupera artículos del corpus y pide a un modelo que redacte la
respuesta **solo** con ellos.

- Recuperación: la actual (BM25) más, cuando exista la base, búsqueda semántica con embeddings.
- Verificación: cada cita que escriba el modelo se comprueba contra lo recuperado; si no coincide, se
  reintenta o se responde "no encontré fundamento". Es la garantía central del proyecto.
- Requiere `ANTHROPIC_API_KEY` como variable de entorno cifrada en Vercel.
- Sin base de datos: no se guarda nada de las conversaciones.

Decisiones abiertas antes de construirla:

1. **Quién paga el uso del modelo.** Una demo pública sin límites es un riesgo de costo. Opciones: límite
   por IP y tope diario global, o acceso por invitación.
2. **Qué modelo.** Sonnet para el uso normal; Opus solo si la calidad lo justifica.
3. **Privacidad.** Aviso claro de que las preguntas se envían a un tercero; recomendar no escribir datos
   personales de beneficiarios.

## Etapa 2: organizaciones reales

- Postgres con pgvector (Neon desde el Marketplace de Vercel) y el esquema de `packages/db`.
- `pnpm --filter @faro/ingesta ingest` y `embeber` para cargar leyes y vectores.
- Inicio de sesión por enlace al correo; la app se conecta como `faro_app` (sujeta a RLS) y el alta de
  organizaciones usa una conexión privilegiada aparte.
- Perfil de la organización y subida de documentos propios (acta, estatutos).

Esta etapa requiere probar por primera vez contra un Postgres real: hasta ahora el esquema, la ingesta
y el aislamiento se probaron con PGlite, que no incluye pgvector.

## Etapa 3: actualizaciones y resumen semanal

- Vercel Cron diario: compara el índice de Diputados con la última reforma conocida y, si cambió, ejecuta
  la ingesta (que deja la reforma pendiente de revisión).
- Pantalla de revisión para aprobar o rechazar reformas pendientes (hoy es solo CLI).
- Cron semanal que arma el resumen de cada organización y lo envía por correo (Resend o SMTP).
- Las alertas por perfil usan las etiquetas de cada artículo, que hoy son heurísticas por palabras clave.

## Riesgos que cruzan todas las etapas

- **Responsabilidad legal:** la herramienta orienta, no sustituye a un abogado. El aviso va en el pie de
  todas las páginas.
- **Fuente única:** si Diputados cambia el formato de sus PDF, el parser puede fallar. El CLI rechaza
  parseos dudosos (números repetidos, pocos artículos) en lugar de publicarlos.
- **Texto consolidado:** no equivale al DOF. Las reformas recientes pueden tardar en reflejarse.
