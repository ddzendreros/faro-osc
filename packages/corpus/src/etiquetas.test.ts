import { describe, expect, it } from "vitest";
import { etiquetarArticulo } from "./etiquetas.js";

describe("etiquetarArticulo", () => {
  it("etiqueta por el contenido del artículo, no por su número", () => {
    const texto =
      "Las personas morales con fines no lucrativos autorizadas para recibir donativos deducibles deberán emitir comprobantes fiscales digitales.";
    expect(etiquetarArticulo("LISR", texto)).toEqual(["cfdi", "donataria", "donativos", "no_lucrativa"]);
  });

  it("toda la ley de OSC y las leyes temáticas llevan su etiqueta aunque el artículo no la nombre", () => {
    expect(etiquetarArticulo("LFFAOSC", "Artículo 9. La Comisión se integrará así.")).toEqual(["osc"]);
    expect(etiquetarArticulo("LFPIORPI", "Artículo 3. Definiciones.")).toEqual(["antilavado"]);
    expect(etiquetarArticulo("LFPDPPP", "Artículo 1. Objeto.")).toEqual(["datos_personales"]);
  });

  it("un artículo sin relación con el sector no recibe etiquetas", () => {
    expect(etiquetarArticulo("CFF", "Artículo 20. Las contribuciones se pagan en moneda nacional.")).toEqual([]);
  });

  it("detecta donativos en leyes generales como el CFF y el antilavado en la LFPIORPI", () => {
    expect(etiquetarArticulo("CFF", "Los donativos se acreditan con el comprobante.")).toContain("donativos");
    expect(etiquetarArticulo("LFPIORPI", "La recepción de donativos es una actividad vulnerable.")).toEqual([
      "antilavado",
      "donativos",
    ]);
  });

  it("devuelve etiquetas únicas y ordenadas", () => {
    const e = etiquetarArticulo("LFFAOSC", "organizaciones de la sociedad civil y organizaciones de la sociedad civil");
    expect(e).toEqual(["osc"]);
  });
});
