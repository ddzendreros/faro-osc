import { describe, expect, it } from "vitest";
import { limpiarPaginasDiputados } from "./limpiar-paginas.js";

const encabezado = (n: number) =>
  [
    "LEY FEDERAL DE FOMENTO A LAS ACTIVIDADES REALIZADAS POR ORGANIZACIONES DE LA SOCIEDAD CIVIL",
    "CÁMARA DE DIPUTADOS DEL H. CONGRESO DE LA UNIÓN",
    "Secretaría General",
    "Secretaría de Servicios Parlamentarios",
    "Última Reforma DOF 01-04-2024",
    `${n} de 21`,
  ].join("\n");

describe("limpiarPaginasDiputados", () => {
  const paginas = [
    `${encabezado(1)}\nArtículo 1. Primer texto\nque continúa`,
    `${encabezado(2)}\nen la página siguiente.\nArtículo 2. Segundo`,
  ];
  const limpio = limpiarPaginasDiputados(paginas);

  it("quita el bloque de encabezado de cada página", () => {
    expect(limpio).not.toMatch(/CÁMARA DE DIPUTADOS|Secretaría|Última Reforma|\d+ de 21/);
  });

  it("une el texto que cruza páginas sin ruido en medio", () => {
    expect(limpio).toBe("Artículo 1. Primer texto\nque continúa\nen la página siguiente.\nArtículo 2. Segundo");
  });

  it("no toca páginas sin encabezado, ni borra líneas que parezcan numeración dentro del texto", () => {
    const texto = "Artículo 3. Texto\n2 de 5 socios deben firmar.";
    expect(limpiarPaginasDiputados([texto])).toBe(texto);
  });

  it("tolera acentos descompuestos (NFD) del PDF", () => {
    const nfd = encabezado(1).normalize("NFD") + "\nArtículo 1. Texto";
    expect(limpiarPaginasDiputados([nfd])).toBe("Artículo 1. Texto");
  });
});
