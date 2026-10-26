# Faro OSC

Agente de IA open source que responde consultas legales a organizaciones de la sociedad civil (OSC) en México, citando el artículo exacto y la versión vigente de la ley. Cada OSC tiene su propio agente, personalizado con su perfil y sus documentos, y recibe un digest semanal con los cambios legales y noticias que le aplican.

Estado: en construcción. Hay un visor del corpus con búsqueda y citas, en línea en https://faro-osc-demo.vercel.app; el agente que responde preguntas todavía no existe. Plan por etapas en [docs/demo.md](docs/demo.md).

## Estructura

```
apps/web            Demo: visor del corpus, búsqueda y citas (Next.js)
apps/worker         Alertas y digest semanal                     — pendiente
packages/corpus     Scraper de Diputados, parser de artículos, diff de versiones, etiquetas
packages/db         Esquema Drizzle + migraciones, RLS por OSC, pgvector
packages/ingesta    Lleva las leyes a la base, cola de revisión de reformas, embeddings
packages/providers  Embeddings con cualquier servicio compatible con la API de OpenAI
packages/core       Agente, herramientas, validador de citas     — pendiente
```

## Desarrollo

```
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @faro/web dev     # la demo en http://localhost:3000
```

Requiere Node 22+ y pnpm 11.

Las pruebas de base de datos usan PGlite (Postgres en WASM), que no incluye pgvector: ahí las columnas
`vector` se sustituyen por `text`. Lo demás (RLS, versionado, restricciones) se ejecuta tal cual.

## Licencia

AGPL-3.0-or-later. Ver [LICENSE](LICENSE). El texto de las leyes es de la Cámara de Diputados.
