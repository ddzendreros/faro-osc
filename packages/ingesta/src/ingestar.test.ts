import { huellaArticulo, type ArticuloParseado } from "@faro/corpus";
import { schema } from "@faro/db";
import { crearBaseDePrueba } from "@faro/db/testing";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ingestarLey, type EntradaLey } from "./ingestar.js";
import { aprobarReforma, rechazarReforma } from "./revision.js";

const { leyes, reformas, articulos } = schema;

const art = (numero: string, texto: string): ArticuloParseado => ({ numero, texto });

function entrada(arts: ArticuloParseado[], fechaVigencia: string): EntradaLey {
  return {
    codigo: "LEY1",
    nombre: "Ley de prueba",
    abreviatura: "LP",
    fuenteUrl: "https://example.test/LEY1.pdf",
    fechaVigencia,
    articulos: arts,
    // Basta con que dependa del contenido, igual que el hash real del texto completo.
    textoSha256: huellaArticulo(arts.map((a) => `${a.numero}:${a.texto}`).join("|")),
  };
}

const V1 = [art("1", "Texto uno"), art("2", "Texto dos"), art("3", "Texto tres")];
const FECHA_INICIAL = "2024-04-01";
const FECHA_REFORMA = "2025-01-01";

let ctx: Awaited<ReturnType<typeof crearBaseDePrueba>>;
let db: typeof ctx.db;

beforeEach(async () => {
  ctx = await crearBaseDePrueba();
  db = ctx.db;
});

/** Texto publicado de un artículo en una fecha dada; null si no hay versión (o no existía). */
async function textoEn(numero: string, fecha: string) {
  const [fila] = await db
    .select({ texto: articulos.texto })
    .from(articulos)
    .where(
      and(
        eq(articulos.numero, numero),
        eq(articulos.estado, "publicado"),
        lte(articulos.vigenteDesde, fecha),
        or(isNull(articulos.vigenteHasta), gt(articulos.vigenteHasta, fecha)),
      ),
    );
  return fila?.texto ?? null;
}

describe("carga inicial", () => {
  it("publica todos los artículos desde la fecha de la última reforma", async () => {
    const r = await ingestarLey(db, entrada(V1, FECHA_INICIAL));
    expect(r).toEqual({ tipo: "carga_inicial", articulos: 3 });

    const filas = await db.select().from(articulos).orderBy(asc(articulos.numero));
    expect(filas.map((a) => [a.numero, a.estado, a.vigenteDesde, a.vigenteHasta, a.reformaId])).toEqual([
      ["1", "publicado", FECHA_INICIAL, null, null],
      ["2", "publicado", FECHA_INICIAL, null, null],
      ["3", "publicado", FECHA_INICIAL, null, null],
    ]);
    const [ley] = await db.select().from(leyes);
    expect(ley).toMatchObject({ codigo: "LEY1", ultimaReformaDof: FECHA_INICIAL });
    expect(ley?.textoSha256).toBe(entrada(V1, FECHA_INICIAL).textoSha256);
  });

  it("no inventa versiones anteriores a la fecha de vigencia", async () => {
    await ingestarLey(db, entrada(V1, FECHA_INICIAL));
    expect(await textoEn("1", "2020-01-01")).toBeNull();
    expect(await textoEn("1", FECHA_INICIAL)).toBe("Texto uno");
  });

  it("repetir la misma ingesta no cambia nada", async () => {
    await ingestarLey(db, entrada(V1, FECHA_INICIAL));
    expect(await ingestarLey(db, entrada(V1, FECHA_INICIAL))).toEqual({ tipo: "sin_cambios" });
    expect(await db.select().from(articulos)).toHaveLength(3);
    expect(await db.select().from(reformas)).toHaveLength(0);
  });

  it("maneja una ley con más artículos que un lote de inserción", async () => {
    const muchos = Array.from({ length: 450 }, (_, i) => art(String(i + 1), `Texto ${i + 1}`));
    const r = await ingestarLey(db, entrada(muchos, FECHA_INICIAL));
    expect(r).toEqual({ tipo: "carga_inicial", articulos: 450 });
    expect(await db.select().from(articulos)).toHaveLength(450);
  });
});

describe("reforma: nada se publica sin aprobación", () => {
  const V2 = [art("1", "Texto uno"), art("2", "Texto dos REFORMADO"), art("4", "Texto cuatro nuevo")]; // cambia 2, agrega 4, quita 3

  async function conReformaPendiente() {
    await ingestarLey(db, entrada(V1, FECHA_INICIAL));
    const r = await ingestarLey(db, entrada(V2, FECHA_REFORMA));
    if (r.tipo !== "reforma_pendiente") throw new Error(`se esperaba reforma_pendiente, hubo ${r.tipo}`);
    return r;
  }

  it("una diferencia real crea una reforma pendiente con el diff", async () => {
    const r = await conReformaPendiente();
    expect(r).toMatchObject({ agregados: 1, modificados: 1, eliminados: 1 });
    const [reforma] = await db.select().from(reformas);
    expect(reforma).toMatchObject({ estado: "pendiente", fechaDof: FECHA_REFORMA });
    expect(reforma?.diff).toMatchObject({
      agregados: [{ numero: "4" }],
      modificados: [{ numero: "2", anterior: "Texto dos", nuevo: "Texto dos REFORMADO" }],
      eliminados: [{ numero: "3" }],
    });
  });

  it("mientras está pendiente, la vigencia publicada no cambia", async () => {
    await conReformaPendiente();
    expect(await textoEn("2", "2025-06-01")).toBe("Texto dos");
    expect(await textoEn("3", "2025-06-01")).toBe("Texto tres");
    expect(await textoEn("4", "2025-06-01")).toBeNull();
    const pendientes = await db.select().from(articulos).where(eq(articulos.estado, "pendiente"));
    expect(pendientes.map((a) => a.numero).sort()).toEqual(["2", "4"]);
  });

  it("reintentar la misma ingesta no duplica la reforma", async () => {
    await conReformaPendiente();
    expect(await ingestarLey(db, entrada(V2, FECHA_REFORMA))).toEqual({ tipo: "sin_cambios" });
    expect(await db.select().from(reformas)).toHaveLength(1);
  });

  it("aprobar cierra las versiones anteriores y publica las nuevas", async () => {
    const { reformaId } = await conReformaPendiente();
    expect(await aprobarReforma(db, reformaId)).toEqual({ publicados: 2, retirados: 2 }); // cierra 2 (modificado) y 3 (eliminado)

    // Antes de la reforma rige el texto viejo; desde su fecha, el nuevo.
    expect(await textoEn("2", "2024-12-31")).toBe("Texto dos");
    expect(await textoEn("2", FECHA_REFORMA)).toBe("Texto dos REFORMADO");
    expect(await textoEn("3", "2024-12-31")).toBe("Texto tres");
    expect(await textoEn("3", FECHA_REFORMA)).toBeNull(); // derogado
    expect(await textoEn("4", FECHA_REFORMA)).toBe("Texto cuatro nuevo");
    expect(await textoEn("1", FECHA_REFORMA)).toBe("Texto uno"); // intacto

    const [reforma] = await db.select().from(reformas);
    expect(reforma?.estado).toBe("aprobada");
    expect(reforma?.revisadaEn).toBeInstanceOf(Date);
  });

  it("no se puede aprobar ni rechazar dos veces", async () => {
    const { reformaId } = await conReformaPendiente();
    await aprobarReforma(db, reformaId);
    await expect(aprobarReforma(db, reformaId)).rejects.toThrow(/no está pendiente/);
    await expect(rechazarReforma(db, reformaId)).rejects.toThrow(/no está pendiente/);
  });

  it("rechazar deja la vigencia como estaba", async () => {
    const { reformaId } = await conReformaPendiente();
    await rechazarReforma(db, reformaId);
    expect(await textoEn("2", "2025-06-01")).toBe("Texto dos");
    expect(await textoEn("3", "2025-06-01")).toBe("Texto tres");
    expect(await db.select().from(articulos).where(eq(articulos.estado, "pendiente"))).toEqual([]);
    const [reforma] = await db.select().from(reformas);
    expect(reforma?.estado).toBe("rechazada");
  });

  it("una reforma nueva reemplaza a la pendiente anterior (el texto es consolidado)", async () => {
    const primera = await conReformaPendiente();
    const V3 = [...V2, art("5", "Otro artículo agregado después")];
    const segunda = await ingestarLey(db, entrada(V3, "2025-03-01"));
    if (segunda.tipo !== "reforma_pendiente") throw new Error("se esperaba reforma_pendiente");

    const todas = await db.select().from(reformas);
    expect(todas.find((r) => r.id === primera.reformaId)?.estado).toBe("rechazada");
    expect(todas.find((r) => r.id === segunda.reformaId)?.estado).toBe("pendiente");
    // La segunda cubre el cambio acumulado: lo de la primera más el artículo 5.
    expect(segunda).toMatchObject({ agregados: 2, modificados: 1, eliminados: 1 });

    await aprobarReforma(db, segunda.reformaId);
    expect(await textoEn("2", "2025-03-01")).toBe("Texto dos REFORMADO");
    expect(await textoEn("5", "2025-03-01")).toBe("Otro artículo agregado después");
  });

  it("un cambio solo de espaciado no genera reforma", async () => {
    await ingestarLey(db, entrada(V1, FECHA_INICIAL));
    const reformateado = [art("1", "Texto   uno"), art("2", "Texto\ndos"), art("3", "Texto tres")];
    // El hash completo sí cambia (hay otro espaciado), pero ningún artículo cambió de fondo.
    const e = { ...entrada(reformateado, FECHA_INICIAL), textoSha256: "otro-hash" };
    expect(await ingestarLey(db, e)).toEqual({ tipo: "sin_cambios_de_fondo" });
    expect(await db.select().from(reformas)).toHaveLength(0);
  });

  it("un texto corregido con la misma fecha reemplaza al anterior sin romper la vigencia", async () => {
    await ingestarLey(db, entrada(V1, FECHA_INICIAL));
    // Diputados corrige un error del PDF sin publicar una nueva reforma en el DOF.
    const corregido = [art("1", "Texto uno"), art("2", "Texto dos corregido"), art("3", "Texto tres")];
    const r = await ingestarLey(db, entrada(corregido, FECHA_INICIAL));
    if (r.tipo !== "reforma_pendiente") throw new Error("se esperaba reforma_pendiente");

    await expect(aprobarReforma(db, r.reformaId)).resolves.toMatchObject({ publicados: 1 });
    expect(await textoEn("2", FECHA_INICIAL)).toBe("Texto dos corregido");
    const versiones2 = await db.select().from(articulos).where(eq(articulos.numero, "2"));
    expect(versiones2.map((v) => v.estado).sort()).toEqual(["publicado", "rechazado"]);
  });
});
