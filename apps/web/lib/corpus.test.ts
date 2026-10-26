import { describe, expect, it } from "vitest";
import { articuloPorSlug, buscador, generadoEn, leyes } from "./corpus";

// Estas pruebas corren contra el snapshot real de Diputados que se publica en la demo.
const claves = (q: string, n = 5) => buscador.buscar(q, n).map((r) => `${r.ley} ${r.numero}`);

describe("snapshot del corpus", () => {
  it("trae las cinco leyes del MVP con el número de artículos que valida el scraper", () => {
    expect(Object.fromEntries(leyes.map((l) => [l.codigo, l.articulos.length]))).toEqual({
      LFFAOSC: 32,
      LISR: 236,
      CFF: 421,
      LFPIORPI: 73,
      LFPDPPP: 64,
    });
    expect(generadoEn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("toda ley tiene fecha de última reforma y nombre legible", () => {
    for (const l of leyes) {
      expect(l.ultimaReforma, l.codigo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.titulo.startsWith(l.titulo.charAt(0).toUpperCase())).toBe(true);
      expect(l.titulo).not.toMatch(/^[A-ZÁÉÍÓÚ]{3,} /); // "LEY del…" ya viene normalizado a "Ley del…"
    }
  });

  it("encuentra los artículos clave para donatarias por su slug de URL", () => {
    expect(articuloPorSlug("LISR", "82-bis")?.articulo.texto).toMatch(/donativos deducibles/);
    expect(articuloPorSlug("LISR", "82-quater")).not.toBeNull();
    expect(articuloPorSlug("CFF", "4o-a")).not.toBeNull();
    expect(articuloPorSlug("LISR", "no-existe")).toBeNull();
  });

  it("enlaza artículos contiguos de una misma ley", () => {
    const r = articuloPorSlug("LISR", "82-bis");
    expect(r?.anterior?.numero).toBe("82");
    expect(r?.siguiente?.numero).toBe("82 Ter");
  });
});

describe("búsqueda sobre el corpus real", () => {
  it("'donativos deducibles' lleva a los artículos de donatarias de la LISR", () => {
    const r = claves("donativos deducibles", 6);
    expect(r).toContain("LISR 82 Bis");
    expect(r.slice(0, 4).every((c) => c.startsWith("LISR"))).toBe(true);
  });

  it("'LISR 82 bis' devuelve solo ese artículo", () => {
    expect(claves("LISR 82 bis")).toEqual(["LISR 82 Bis"]);
  });

  it("'aviso de privacidad' lleva a la ley de datos personales", () => {
    expect(buscador.buscar("aviso de privacidad", 1)[0]?.ley).toBe("LFPDPPP");
  });

  it("'registro' en el contexto de OSC lleva a la ley de fomento", () => {
    expect(buscador.buscar("cluni registro", 1)[0]?.ley).toBe("LFFAOSC");
  });

  it("'actividad vulnerable donativos' llega a la ley antilavado", () => {
    expect(claves("actividad vulnerable donativos", 4).some((c) => c.startsWith("LFPIORPI"))).toBe(true);
  });
});
