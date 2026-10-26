import type { ProveedorEmbeddings } from "@faro/providers";
import { EMBEDDING_DIMS, schema } from "@faro/db";
import { crearBaseDePrueba } from "@faro/db/testing";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { embeberPendientes } from "./embeber.js";
import { ingestarLey } from "./ingestar.js";
import { aprobarReforma } from "./revision.js";

const { articulos } = schema;

/** Vector determinista a partir del texto; basta para comprobar qué se envió y dónde se guardó. */
function proveedorFalso(modelo = "falso-1", dimensiones = EMBEDDING_DIMS) {
  const llamadas: string[][] = [];
  const proveedor: ProveedorEmbeddings = {
    modelo,
    dimensiones,
    embeber: vi.fn(async (textos: string[]) => {
      llamadas.push(textos);
      return textos.map((t) => Array.from({ length: dimensiones }, () => t.length / 1000));
    }),
  };
  return { proveedor, llamadas };
}

let ctx: Awaited<ReturnType<typeof crearBaseDePrueba>>;
const art = (numero: string, texto: string) => ({ numero, texto });
const entrada = (arts: { numero: string; texto: string }[], fecha: string, sha: string) => ({
  codigo: "LEY1", nombre: "Ley de prueba", abreviatura: "LP", fuenteUrl: "https://x", fechaVigencia: fecha, articulos: arts, textoSha256: sha,
});

beforeEach(async () => {
  ctx = await crearBaseDePrueba();
  await ingestarLey(ctx.db, entrada([art("1", "Uno"), art("2", "Dos"), art("3", "Tres")], "2024-04-01", "a"));
});

describe("embeberPendientes", () => {
  it("procesa los artículos publicados en lotes y guarda vector y modelo", async () => {
    const { proveedor, llamadas } = proveedorFalso();
    expect(await embeberPendientes(ctx.db, proveedor, { lote: 2 })).toBe(3);
    expect(llamadas.map((l) => l.length)).toEqual([2, 1]);
    const filas = await ctx.db.select().from(articulos);
    expect(filas.every((f) => f.embedding?.length === EMBEDDING_DIMS && f.embeddingModelo === "falso-1")).toBe(true);
  });

  it("antepone la cita (ley y número) al texto que se embebe", async () => {
    const { proveedor, llamadas } = proveedorFalso();
    await embeberPendientes(ctx.db, proveedor);
    expect(llamadas.flat()).toContain("LP art. 1\nUno");
  });

  it("es idempotente: sin artículos nuevos no vuelve a llamar al modelo", async () => {
    const { proveedor } = proveedorFalso();
    await embeberPendientes(ctx.db, proveedor);
    const antes = vi.mocked(proveedor.embeber).mock.calls.length;
    expect(await embeberPendientes(ctx.db, proveedor)).toBe(0);
    expect(vi.mocked(proveedor.embeber).mock.calls.length).toBe(antes);
  });

  it("reindexa todo cuando cambia el modelo", async () => {
    await embeberPendientes(ctx.db, proveedorFalso("modelo-viejo").proveedor);
    expect(await embeberPendientes(ctx.db, proveedorFalso("modelo-nuevo").proveedor)).toBe(3);
    const modelos = (await ctx.db.select().from(articulos)).map((f) => f.embeddingModelo);
    expect(new Set(modelos)).toEqual(new Set(["modelo-nuevo"]));
  });

  it("no procesa artículos pendientes de aprobación, y sí los nuevos una vez aprobados", async () => {
    const { proveedor } = proveedorFalso();
    await embeberPendientes(ctx.db, proveedor);
    const r = await ingestarLey(ctx.db, entrada([art("1", "Uno"), art("2", "Dos REFORMADO"), art("3", "Tres")], "2025-01-01", "b"));
    if (r.tipo !== "reforma_pendiente") throw new Error("se esperaba reforma_pendiente");

    expect(await embeberPendientes(ctx.db, proveedor)).toBe(0); // el pendiente aún no es consultable
    await aprobarReforma(ctx.db, r.reformaId);
    expect(await embeberPendientes(ctx.db, proveedor)).toBe(1);
    const [nuevo] = await ctx.db.select().from(articulos).where(eq(articulos.texto, "Dos REFORMADO"));
    expect(nuevo?.embedding).toHaveLength(EMBEDDING_DIMS);
  });

  it("rechaza un proveedor cuya dimensión no es la del esquema", async () => {
    await expect(embeberPendientes(ctx.db, proveedorFalso("chico", 768).proveedor)).rejects.toThrow(/migración/);
  });
});
