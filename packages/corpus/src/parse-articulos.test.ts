import { describe, expect, it } from "vitest";
import { parseArticulos } from "./parse-articulos.js";

const LEY = `
TÍTULO III
Artículo 79.- No son contribuyentes del impuesto sobre la renta las siguientes personas morales:
I. Asociaciones civiles.
Artículo 80.- Las personas morales con fines no lucrativos
tributarán conforme a este Título.
Artículo 10 Bis.- Texto con sufijo latino.
Artículo 29-A.- Texto con letra.
Artículo 1o.- Texto con ordinal.
TRANSITORIOS
ARTÍCULO PRIMERO.- Entra en vigor mañana.
`;

describe("parseArticulos", () => {
  const r = parseArticulos(LEY);

  it("extrae los números tal como se citan", () => {
    expect(r.map((a) => a.numero)).toEqual(["79", "80", "10 Bis", "29-A", "1o"]);
  });

  it("conserva fracciones y párrafos multilínea dentro del artículo", () => {
    expect(r[0]?.texto).toContain("I. Asociaciones civiles.");
    expect(r[1]?.texto).toContain("tributarán conforme a este Título.");
  });

  it("no incluye los transitorios", () => {
    expect(r.some((a) => a.texto.includes("Entra en vigor"))).toBe(false);
  });

  it("corta en 'Transitorios' aunque no esté en mayúsculas", () => {
    const texto = "Artículo 32. Último artículo.\nTransitorios\nPrimero. Entra en vigor.\nArtículo 5. Cita ajena.";
    expect(parseArticulos(texto).map((a) => a.numero)).toEqual(["32"]);
  });

  it("no corta por un renglón que solo menciona el artículo transitorio", () => {
    const texto = "Artículo 1. Texto\nde acuerdo con el artículo transitorio Tercero del decreto\nArtículo 2. Otro";
    expect(parseArticulos(texto).map((a) => a.numero)).toEqual(["1", "2"]);
  });

  it("no toma como encabezado una referencia en minúsculas al inicio de renglón", () => {
    const texto = "Artículo 1. Se aplica lo dispuesto en el\nartículo 5. Esto es continuación.\nArtículo 2. Otro";
    const r = parseArticulos(texto);
    expect(r.map((a) => a.numero)).toEqual(["1", "2"]);
    expect(r[0]?.texto).toContain("artículo 5. Esto es continuación.");
  });

  it("reconoce sufijos latinos en mayúsculas", () => {
    expect(parseArticulos("ARTÍCULO 7 BIS.- Texto").map((a) => a.numero)).toEqual(["7 Bis"]);
  });

  it("distingue 82, 82-Bis, 82-Ter y 82-Quáter (formato real de la LISR)", () => {
    const texto = [
      "Artículo 82. Las personas morales con fines no lucrativos",
      "Artículo 82-Bis. Las instituciones autorizadas",
      "Artículo 82-Ter. Se deroga.",
      "Artículo 82-Quáter. Para los efectos del párrafo cuarto",
    ].join("\n");
    expect(parseArticulos(texto).map((a) => a.numero)).toEqual(["82", "82 Bis", "82 Ter", "82 Quáter"]);
  });

  it("reconoce los formatos del CFF: 4o.-A.-, 5o.-A., 208-Bis.-", () => {
    const texto = [
      "Artículo 4o.- Son créditos fiscales",
      "Artículo 4o.-A.- Los impuestos y sus accesorios",
      "Artículo 5o.-A. Los actos jurídicos",
      "Artículo 208.- (Se deroga).",
      "Artículo 208-Bis.- (Se deroga).",
    ].join("\n");
    expect(parseArticulos(texto).map((a) => a.numero)).toEqual(["4o", "4o-A", "5o-A", "208", "208 Bis"]);
  });

  it("no confunde la primera letra del texto con un sufijo: '20.-Las contribuciones' es el 20", () => {
    expect(parseArticulos("Artículo 20.-Las contribuciones se causarán").map((a) => a.numero)).toEqual(["20"]);
  });

  it("usa la misma clave sin importar la grafía del PDF (guion o espacio, mayúsculas)", () => {
    const nums = ["Artículo 10 Bis.- x", "Artículo 10-Bis.- x", "ARTÍCULO 10 BIS.- x"].map(
      (t) => parseArticulos(t)[0]?.numero,
    );
    expect(new Set(nums)).toEqual(new Set(["10 Bis"]));
  });

  it("devuelve lista vacía si no hay artículos", () => {
    expect(parseArticulos("Texto sin articulado")).toEqual([]);
  });
});
