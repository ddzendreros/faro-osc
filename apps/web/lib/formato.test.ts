import { describe, expect, it } from "vitest";
import { cita, fechaCorta, fechaLarga, parrafos, plegar, slugNumero, tituloLey } from "./formato";

describe("slugNumero", () => {
  it("genera slugs de URL a partir de las claves canónicas del parser", () => {
    expect(slugNumero("82")).toBe("82");
    expect(slugNumero("82 Bis")).toBe("82-bis");
    expect(slugNumero("82 Quáter")).toBe("82-quater");
    expect(slugNumero("4o-A")).toBe("4o-a");
  });
});

describe("plegar", () => {
  it("quita acentos sin cambiar la longitud (los índices del texto original se conservan)", () => {
    const t = "Obligación Física, ÚNICA señal";
    expect(plegar(t)).toBe("obligacion fisica, unica senal");
    expect(plegar(t)).toHaveLength(t.length);
  });
});

describe("formato", () => {
  it("fechas sin correrse de día por la zona horaria", () => {
    expect(fechaLarga("2024-04-01")).toBe("1 de abril de 2024");
    expect(fechaCorta("2024-04-01")).toBe("01/04/2024");
  });

  it("arma la cita con ley, artículo y fecha del texto", () => {
    expect(cita("LISR", "82 Bis", "2024-04-01")).toBe("[LISR art. 82 Bis, texto al 01/04/2024]");
    expect(cita("LISR", "82", null)).toBe("[LISR art. 82]");
  });

  it("pone en minúsculas la primera palabra que Diputados escribe en mayúsculas", () => {
    expect(tituloLey("LEY del Impuesto sobre la Renta")).toBe("Ley del Impuesto sobre la Renta");
    expect(tituloLey("CÓDIGO Fiscal de la Federación")).toBe("Código Fiscal de la Federación");
  });
});

describe("parrafos", () => {
  const texto = [
    "Artículo 82-Bis. Las instituciones autorizadas para recibir donativos",
    "deducibles en términos de esta Ley, que reciban donativos.",
    "Para estos efectos se estará a lo siguiente:",
    "I. Contar con comprobantes",
    "fiscales digitales;",
    "II. Presentar la declaración.",
    "a) Anual",
  ].join("\n");
  const r = parrafos(texto);

  it("quita el rótulo 'Artículo N.' porque el número ya va en el margen", () => {
    expect(r[0]?.texto.startsWith("Las instituciones autorizadas")).toBe(true);
  });

  it("une los renglones cortados del PDF en un solo párrafo", () => {
    expect(r[0]?.texto).toBe(
      "Las instituciones autorizadas para recibir donativos deducibles en términos de esta Ley, que reciban donativos.",
    );
  });

  it("separa párrafos tras un punto y marca fracciones e incisos como sangrados", () => {
    expect(r.map((p) => [p.texto.slice(0, 12), p.sangrado])).toEqual([
      ["Las instituc", false],
      ["Para estos e", false],
      ["I. Contar co", true],
      ["II. Presenta", true],
      ["a) Anual", true],
    ]);
    expect(r[2]?.texto).toBe("I. Contar con comprobantes fiscales digitales;");
  });

  it("distingue las notas editoriales de reforma del texto de la ley", () => {
    const r = parrafos(
      "Artículo 82-Bis. Las instituciones autorizadas deberán informar.\nArtículo adicionado DOF 30-11-2016\nFracción reformada DOF 01-04-2024",
    );
    expect(r.map((p) => p.nota)).toEqual([false, true, true]);
  });

  it("no toma como nota un párrafo largo que solo menciona el DOF", () => {
    const largo = `Las instituciones deberán publicar en el DOF 01-04-2024 lo reformado ${"texto ".repeat(50)}`;
    expect(parrafos(`Artículo 1. ${largo}`)[0]?.nota).toBe(false);
  });

  it("quita rótulos con letra pegada como 'Artículo 4o.-A.-'", () => {
    expect(parrafos("Artículo 4o.-A.- Los impuestos y sus accesorios")[0]?.texto).toBe("Los impuestos y sus accesorios");
  });

  it("si no reconoce el rótulo, conserva el texto completo en lugar de perderlo", () => {
    expect(parrafos("Texto sin rótulo")[0]?.texto).toBe("Texto sin rótulo");
  });
});
