import { describe, expect, it } from "vitest";
import { diffVersiones } from "./diff-versiones.js";

const art = (numero: string, texto: string) => ({ numero, texto });

describe("diffVersiones", () => {
  const vigentes = [art("79", "Texto A"), art("80", "Texto B"), art("81", "Texto C")];

  it("detecta artículos agregados, modificados y eliminados", () => {
    const nuevos = [art("79", "Texto A"), art("80", "Texto B reformado"), art("82", "Texto D")];
    const d = diffVersiones(vigentes, nuevos);
    expect(d.agregados.map((a) => a.numero)).toEqual(["82"]);
    expect(d.modificados).toEqual([
      { numero: "80", anterior: "Texto B", nuevo: "Texto B reformado" },
    ]);
    expect(d.eliminados.map((a) => a.numero)).toEqual(["81"]);
  });

  it("ignora diferencias solo de espacios o saltos de línea", () => {
    const d = diffVersiones([art("1", "Uno  dos\ntres")], [art("1", "Uno dos tres")]);
    expect(d.modificados).toEqual([]);
  });

  it("sin cambios devuelve un diff vacío", () => {
    expect(diffVersiones(vigentes, vigentes)).toEqual({
      agregados: [],
      modificados: [],
      eliminados: [],
    });
  });
});
