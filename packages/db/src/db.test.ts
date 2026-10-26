import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { crearBaseDePrueba, mensajeDeError } from "./testing.js";
import { conOrg } from "./org.js";
import {
  alertas,
  articulos,
  conversaciones,
  digests,
  leyes,
  organizaciones,
  reformas,
  usuarios,
} from "./schema/index.js";

let ctx: Awaited<ReturnType<typeof crearBaseDePrueba>>;
let orgA: string;
let orgB: string;
let convB: string;
let leyId: string;
let reformaAprobada: string;

const enApp = () => ctx.pg.exec("SET ROLE faro_app");

beforeAll(async () => {
  ctx = await crearBaseDePrueba();
  const { db } = ctx;
  [{ id: orgA }, { id: orgB }] = (await db
    .insert(organizaciones)
    .values([
      { nombre: "OSC A", figuraJuridica: "AC", esDonataria: true },
      { nombre: "OSC B", figuraJuridica: "IAP" },
    ])
    .returning({ id: organizaciones.id })) as [{ id: string }, { id: string }];
  [, { id: convB }] = (await db
    .insert(conversaciones)
    .values([
      { orgId: orgA, titulo: "de A" },
      { orgId: orgB, titulo: "de B" },
    ])
    .returning({ id: conversaciones.id })) as [{ id: string }, { id: string }];
  [{ id: leyId }] = (await db
    .insert(leyes)
    .values({ codigo: "LISR", nombre: "Ley del ISR", abreviatura: "LISR", fuenteUrl: "https://x" })
    .returning({ id: leyes.id })) as [{ id: string }];
  [{ id: reformaAprobada }] = (await db
    .insert(reformas)
    .values({ leyId, fechaDof: "2024-04-01", estado: "aprobada" })
    .returning({ id: reformas.id })) as [{ id: string }];
});

afterEach(async () => {
  await ctx.pg.exec("RESET ROLE");
});

describe("migraciones", () => {
  it("se aplican completas y crean las tablas del plan", async () => {
    const r = await ctx.pg.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by 1",
    );
    expect(r.rows.map((t) => t.tablename)).toEqual(
      expect.arrayContaining([
        "leyes", "reformas", "articulos", "fuentes_noticias", "noticias", "usuarios",
        "organizaciones", "miembros", "documentos_osc", "fragmentos_osc", "conversaciones",
        "mensajes", "alertas", "preferencias_digest", "digests",
      ]),
    );
  });
});

describe("aislamiento entre OSC (RLS)", () => {
  it("cada OSC solo ve sus propias filas", async () => {
    await enApp();
    const deA = await conOrg(ctx.db, orgA, (tx) => tx.select().from(conversaciones));
    const deB = await conOrg(ctx.db, orgB, (tx) => tx.select().from(conversaciones));
    expect(deA.map((c) => c.titulo)).toEqual(["de A"]);
    expect(deB.map((c) => c.titulo)).toEqual(["de B"]);
  });

  it("la OSC solo ve su propio registro en organizaciones", async () => {
    await enApp();
    const orgs = await conOrg(ctx.db, orgA, (tx) => tx.select().from(organizaciones));
    expect(orgs.map((o) => o.nombre)).toEqual(["OSC A"]);
  });

  it("sin contexto de OSC no se ve nada (y no truena por uuid vacío)", async () => {
    await enApp();
    expect(await ctx.db.select().from(conversaciones)).toEqual([]);
    // Tampoco queda el contexto de una transacción anterior.
    await conOrg(ctx.db, orgA, (tx) => tx.select().from(conversaciones));
    expect(await ctx.db.select().from(conversaciones)).toEqual([]);
  });

  it("no se puede escribir una fila de otra OSC", async () => {
    await enApp();
    const msg = await mensajeDeError(
      conOrg(ctx.db, orgA, (tx) => tx.insert(conversaciones).values({ orgId: orgB, titulo: "intruso" })),
    );
    expect(msg).toMatch(/row-level security/);
  });

  it("no se puede modificar una fila de otra OSC (afecta 0 filas)", async () => {
    await enApp();
    const r = await conOrg(ctx.db, orgA, (tx) =>
      tx.update(conversaciones).set({ titulo: "hackeada" }).where(eq(conversaciones.id, convB)).returning(),
    );
    expect(r).toEqual([]);
    await ctx.pg.exec("RESET ROLE");
    const [b] = await ctx.db.select().from(conversaciones).where(eq(conversaciones.id, convB));
    expect(b?.titulo).toBe("de B");
  });

  it("la app no puede leer la tabla global de usuarios", async () => {
    await enApp();
    const msg = await mensajeDeError(conOrg(ctx.db, orgA, (tx) => tx.select().from(usuarios)));
    expect(msg).toMatch(/permission denied for table usuarios/);
  });

  it("conOrg rechaza un orgId que no es UUID", async () => {
    await expect(conOrg(ctx.db, "x'; drop table leyes;--", async () => 1)).rejects.toThrow(/UUID/);
  });
});

describe("corpus: lo no aprobado no es visible para la app", () => {
  it("solo ve artículos publicados y reformas aprobadas", async () => {
    const [reformaPendiente] = await ctx.db
      .insert(reformas)
      .values({ leyId, fechaDof: "2025-01-01", estado: "pendiente" })
      .returning();
    await ctx.db.insert(articulos).values([
      { leyId, numero: "79", texto: "publicado", textoSha256: "h1", vigenteDesde: "2020-01-01" },
      {
        leyId, numero: "79", texto: "borrador sin aprobar", textoSha256: "h2",
        vigenteDesde: "2025-01-01", estado: "pendiente", reformaId: reformaPendiente!.id,
      },
    ]);
    await enApp();
    const arts = await conOrg(ctx.db, orgA, (tx) => tx.select().from(articulos).where(eq(articulos.numero, "79")));
    const refs = await conOrg(ctx.db, orgA, (tx) => tx.select().from(reformas));
    expect(arts.map((a) => a.texto)).toEqual(["publicado"]);
    expect(refs.map((r) => r.estado)).toEqual(["aprobada"]);
  });

  it("la app no puede escribir en el corpus", async () => {
    await enApp();
    const msg = await mensajeDeError(
      conOrg(ctx.db, orgA, (tx) =>
        tx.insert(articulos).values({ leyId, numero: "1", texto: "x", textoSha256: "x", vigenteDesde: "2020-01-01" }),
      ),
    );
    expect(msg).toMatch(/permission denied/);
  });
});

describe("versionado de artículos", () => {
  const v = (texto: string, vigenteDesde: string, extra: object = {}) => ({
    leyId, numero: "82", texto, textoSha256: texto, vigenteDesde, ...extra,
  });

  it("rechaza dos versiones publicadas que se traslapan", async () => {
    await ctx.db.insert(articulos).values(v("v1", "2020-01-01"));
    const msg = await mensajeDeError(ctx.db.insert(articulos).values(v("v2", "2024-01-01")));
    expect(msg).toMatch(/articulos_sin_traslape/);
  });

  it("acepta la nueva versión al cerrar la anterior, y responde 'qué decía la ley en tal fecha'", async () => {
    await ctx.db
      .update(articulos)
      .set({ vigenteHasta: "2024-01-01" })
      .where(and(eq(articulos.leyId, leyId), eq(articulos.numero, "82"), isNull(articulos.vigenteHasta)));
    await ctx.db.insert(articulos).values(v("v2", "2024-01-01"));

    const enFecha = async (f: string) =>
      (
        await ctx.db
          .select()
          .from(articulos)
          .where(
            and(
              eq(articulos.leyId, leyId),
              eq(articulos.numero, "82"),
              eq(articulos.estado, "publicado"),
              lte(articulos.vigenteDesde, f),
              or(isNull(articulos.vigenteHasta), gt(articulos.vigenteHasta, f)),
            ),
          )
      ).map((a) => a.texto);

    expect(await enFecha("2023-06-01")).toEqual(["v1"]);
    expect(await enFecha("2024-01-01")).toEqual(["v2"]); // el intervalo es [desde, hasta)
    expect(await enFecha("2026-10-26")).toEqual(["v2"]);
  });

  it("una versión pendiente puede traslapar con la publicada (aún no vale)", async () => {
    await expect(
      ctx.db.insert(articulos).values(v("borrador", "2025-01-01", { estado: "pendiente" })),
    ).resolves.toBeDefined();
  });

  it("rechaza un intervalo vacío o invertido", async () => {
    const msg = await mensajeDeError(
      ctx.db.insert(articulos).values({ ...v("x", "2030-01-01"), numero: "999", vigenteHasta: "2029-01-01" }),
    );
    expect(msg).toMatch(/articulos_intervalo_valido/);
  });

  it("el índice de texto completo en español encuentra por raíz de palabra", async () => {
    await ctx.db.insert(articulos).values({
      ...v("Las donatarias autorizadas emiten comprobantes de donativos", "2020-01-01"),
      numero: "82-test",
    });
    const r = await ctx.db
      .select({ numero: articulos.numero })
      .from(articulos)
      .where(sql`${articulos.busqueda} @@ plainto_tsquery('spanish', 'donativo')`);
    expect(r.map((x) => x.numero)).toContain("82-test");
  });
});

describe("idempotencia del worker", () => {
  it("una reforma alerta una sola vez a cada OSC", async () => {
    await ctx.db.insert(alertas).values({ orgId: orgA, reformaId: reformaAprobada });
    const msg = await mensajeDeError(ctx.db.insert(alertas).values({ orgId: orgA, reformaId: reformaAprobada }));
    expect(msg).toMatch(/alertas_org_reforma_uq/);
  });

  it("hay un solo digest por OSC y semana", async () => {
    await ctx.db.insert(digests).values({ orgId: orgA, semana: "2026-10-26", contenido: "uno" });
    const msg = await mensajeDeError(
      ctx.db.insert(digests).values({ orgId: orgA, semana: "2026-10-26", contenido: "dos" }),
    );
    expect(msg).toMatch(/digests_org_semana_uq/);
  });
});
