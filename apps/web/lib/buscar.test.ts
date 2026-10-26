import { describe, expect, it } from "vitest";
import { claveNumero, crearBuscador, parseReferencia, raiz, type Doc } from "./buscar";

const doc = (ley: string, numero: string, texto: string): Doc => ({ ley, numero, slug: numero.toLowerCase().replace(/\s+/g, "-"), texto });

const DOCS: Doc[] = [
  doc("LISR", "82", "Las personas morales con fines no lucrativos autorizadas para recibir donativos deberán destinarlos a sus fines."),
  doc("LISR", "82 Bis", "Las instituciones autorizadas para recibir donativos deducibles presentarán su declaración informativa."),
  doc("LISR", "83", "Los ingresos por actividades distintas se consideran ingresos acumulables."),
  doc("LFPDPPP", "16", "El aviso de privacidad deberá contener la identidad del responsable que recaba los datos personales."),
  doc("CFF", "4o", "Son créditos fiscales los que tenga derecho a percibir el Estado."),
  doc("CFF", "4o-A", "Los impuestos y sus accesorios exigibles por los Estados."),
];
const LEYES = ["LISR", "LFPDPPP", "CFF"];
const { buscar } = crearBuscador(DOCS, LEYES);
const claves = (q: string) => buscar(q).map((r) => `${r.ley} ${r.numero}`);

describe("raiz", () => {
  it("une singular, plural y género", () => {
    expect(raiz("donativos")).toBe(raiz("donativo"));
    expect(raiz("donatarias")).toBe(raiz("donataria"));
    expect(raiz("autorizadas")).toBe(raiz("autorizado"));
  });
});

describe("buscar por contenido", () => {
  it("encuentra por palabras sin importar acentos, mayúsculas ni plural", () => {
    expect(claves("DONATIVO deducible")[0]).toBe("LISR 82 Bis");
    expect(claves("aviso de privacidad")).toEqual(["LFPDPPP 16"]);
    expect(claves("declaracion informativa")[0]).toBe("LISR 82 Bis");
  });

  it("una consulta sin coincidencias devuelve vacío, no basura", () => {
    expect(buscar("astronauta")).toEqual([]);
    expect(buscar("   ")).toEqual([]);
  });

  it("resalta las palabras encontradas en el fragmento", () => {
    const r = buscar("privacidad")[0];
    expect(r?.fragmento.filter((s) => s.resaltado).map((s) => s.texto)).toEqual(["privacidad"]);
  });

  it("respeta el límite de resultados", () => {
    expect(buscar("autorizadas donativos", 1)).toHaveLength(1);
  });
});

describe("referencias directas a un artículo", () => {
  it("'LISR 82 bis' pone ese artículo primero y lo marca como exacto", () => {
    const r = buscar("LISR 82 bis")[0];
    expect([r?.ley, r?.numero, r?.exacto]).toEqual(["LISR", "82 Bis", true]);
  });

  it("una referencia pura devuelve solo ese artículo, sin los que apenas mencionan el número", () => {
    expect(claves("LISR 82 bis")).toEqual(["LISR 82 Bis"]);
    expect(claves("art 82")).toEqual(["LISR 82"]);
  });

  it("si la consulta suma palabras, además del artículo exacto aparecen los que hablan del tema", () => {
    const r = claves("LISR 82 donativos");
    expect(r[0]).toBe("LISR 82");
    expect(r).toContain("LISR 82 Bis");
  });

  it("entiende 'art. 82-bis', 'artículo 82 Bis' y 'lisr 82bis' como el mismo artículo", () => {
    for (const q of ["art. 82-bis", "artículo 82 Bis", "lisr 82bis"]) {
      expect(buscar(q)[0]).toMatchObject({ ley: "LISR", numero: "82 Bis", exacto: true });
    }
  });

  it("'cff 4o' y 'cff 4' llegan al 4o; el 4o-A es otro artículo", () => {
    expect(buscar("cff 4o")[0]).toMatchObject({ numero: "4o", exacto: true });
    expect(buscar("cff 4")[0]).toMatchObject({ numero: "4o", exacto: true });
    expect(buscar("art 4o-a")[0]).toMatchObject({ numero: "4o-A", exacto: true });
  });

  it("un número suelto dentro de una frase no se toma como referencia", () => {
    expect(parseReferencia("plazo de 15 dias para presentar el aviso", LEYES)).toBeNull();
  });

  it("claveNumero no confunde el 1o con el 10", () => {
    expect(claveNumero("1o")).toBe("1");
    expect(claveNumero("10")).toBe("10");
    expect(claveNumero("82 Bis")).toBe(claveNumero("82-bis"));
  });
});
