# Faro OSC

Agente de IA open source que responde consultas legales a organizaciones de la sociedad civil (OSC) en México, citando el artículo exacto y la versión vigente de la ley. Cada OSC tiene su propio agente, personalizado con su perfil y sus documentos, y recibe un digest semanal con los cambios legales y noticias que le aplican.

Estado: en construcción. Hecho: scraper de Diputados + parser/versionado (`@faro/corpus`) y esquema de base de datos con RLS (`@faro/db`).

## Estructura

```
apps/web         UI (chat, onboarding, panel)        — pendiente
apps/worker      Ingesta, alertas y digest semanal   — pendiente
packages/corpus  Scraper de Diputados, parser de artículos, diff de versiones (CLI: `pnpm --filter @faro/corpus corpus ingest`)
packages/db      Esquema Drizzle + migraciones, RLS por OSC, pgvector
packages/core    Agente, herramientas, validador de citas — pendiente
packages/providers  Capa de LLM/embeddings intercambiable — pendiente
```

## Desarrollo

```
pnpm install
pnpm test
pnpm typecheck
```

Requiere Node 22+ y pnpm 11.

## Licencia

AGPL-3.0-or-later. Falta añadir el archivo `LICENSE` con el texto oficial.
