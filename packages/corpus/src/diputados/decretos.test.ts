import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDecretosRef } from "./decretos.js";
import { decodificarHtmlDiputados } from "./indice.js";

const html = decodificarHtmlDiputados(
  new Uint8Array(readFileSync(new URL("./fixtures/ref_lffaosc.html", import.meta.url))),
);
const decretos = parseDecretosRef(html, "ref/lffaosc.htm");

describe("parseDecretosRef (página real de la ley de OSC)", () => {
  it("encuentra el decreto de la última reforma, aunque el enlace cruce renglones", () => {
    expect(decretos[0]).toEqual({
      fecha: "2024-04-01",
      url: "https://www.diputados.gob.mx/LeyesBiblio/ref/lffaosc/LFFAOSC_ref07_01abr24.pdf",
    });
  });

  it("incluye la publicación original y ordena de la más reciente a la más antigua", () => {
    const fechas = decretos.map((d) => d.fecha);
    expect(fechas).toContain("2004-02-09");
    expect(fechas).toEqual([...fechas].sort().reverse());
  });

  it("devuelve una sola entrada por fecha", () => {
    expect(new Set(decretos.map((d) => d.fecha)).size).toBe(decretos.length);
  });

  it("no inventa nada si la página no tiene decretos", () => {
    expect(parseDecretosRef("<html>sin tabla</html>", "ref/x.htm")).toEqual([]);
  });
});
