import { descargarIndice, descargarPdfLey, procesarPdfLey } from "@faro/corpus";
import { schema } from "@faro/db";
import { crearBaseDePrueba } from "@faro/db/testing";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ingestarLey } from "./ingestar.js";

// Usa la red y los PDF reales de Diputados. Se activa con FARO_RED=1 para que la suite normal
// no dependa de un sitio externo.
describe.skipIf(!process.env.FARO_RED)("ingesta con datos reales de Diputados", () => {
  it("lleva la ley de OSC a la base y la repetición no cambia nada", async () => {
    const { db } = await crearBaseDePrueba();
    const ley = (await descargarIndice()).find((l) => l.codigo === "LFFAOSC");
    expect(ley?.ultimaReforma).toBeTruthy();
    const { articulos, sha256 } = await procesarPdfLey(await descargarPdfLey("LFFAOSC"));
    const entrada = {
      codigo: "LFFAOSC",
      nombre: ley!.nombre,
      abreviatura: "LFFAOSC",
      fuenteUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFFAOSC.pdf",
      fechaVigencia: ley!.ultimaReforma!,
      articulos,
      textoSha256: sha256,
    };

    expect(await ingestarLey(db, entrada)).toEqual({ tipo: "carga_inicial", articulos: 32 });
    expect(await ingestarLey(db, entrada)).toEqual({ tipo: "sin_cambios" });

    const [art1] = await db.select().from(schema.articulos).where(eq(schema.articulos.numero, "1"));
    expect(art1?.texto).toMatch(/orden público e interés social/);
    expect(art1?.vigenteDesde).toBe(ley!.ultimaReforma);
  }, 120_000);
});
