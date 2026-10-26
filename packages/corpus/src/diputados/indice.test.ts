import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodificarHtmlDiputados, parseIndiceDiputados } from "./indice.js";

const html = decodificarHtmlDiputados(
  new Uint8Array(readFileSync(new URL("./fixtures/indice.html", import.meta.url))),
);
const leyes = parseIndiceDiputados(html);
const porCodigo = (c: string) => leyes.find((l) => l.codigo === c);

describe("parseIndiceDiputados (fixture real de Diputados)", () => {
  it("extrae una ley por fila", () => {
    expect(leyes.map((l) => l.codigo).sort()).toEqual(
      ["79", "CFF", "LFFAOSC", "LFPDPPP", "LFPIORPI", "LISR"].sort(),
    );
  });

  it("lee fechas de publicación y última reforma en ISO", () => {
    expect(porCodigo("LFFAOSC")).toMatchObject({
      publicadaDof: "2004-02-09",
      ultimaReforma: "2024-04-01",
    });
    expect(porCodigo("LISR")).toMatchObject({
      publicadaDof: "2013-12-11",
      ultimaReforma: "2024-04-01",
    });
    expect(porCodigo("CFF")?.ultimaReforma).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("devuelve ultimaReforma null cuando dice 'Sin reforma' (ley cuyo PDF es pdf/79.pdf, no una sigla)", () => {
    expect(porCodigo("79")?.ultimaReforma).toBeNull();
  });

  it("conserva los acentos (el HTML viene en Windows-1252, no UTF-8)", () => {
    expect(porCodigo("LISR")?.nombre).toBe("LEY del Impuesto sobre la Renta");
    expect(leyes.some((l) => l.nombre.includes("�"))).toBe(false);
    expect(porCodigo("LFPIORPI")?.nombre).toMatch(/Procedencia Ilícita/);
  });
});
