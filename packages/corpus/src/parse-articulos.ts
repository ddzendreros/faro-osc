export interface ArticuloParseado {
  /** Número tal como se cita: "82", "29-A", "10 Bis", "1o". */
  numero: string;
  texto: string;
}

const SUFIJOS = [
  "Bis",
  "Ter",
  "Quáter",
  "Quater",
  "Quinquies",
  "Sexies",
  "Septies",
  "Octies",
  "Nonies",
  "Decies",
];
const SUFIJOS_LATINOS = SUFIJOS.flatMap((s) => [s, s.toUpperCase()]).join("|");

// Formas reales en Diputados: "Artículo 82.-", "1o.-", "29-A.-", "10 Bis.-", "82-Bis.", "82-Quáter.",
// "4o.-A.-", "5o.-A.", "208-Bis.-". Una letra suelta solo cuenta como sufijo si va pegada y no
// continúa en otra letra: así "20.-Las contribuciones" no se lee como "20-L".
// Es sensible a mayúsculas a propósito: un renglón partido que empiece con "artículo 5." en
// minúsculas es una referencia dentro del texto, no un encabezado.
const ENCABEZADO = new RegExp(
  String.raw`^\s*(?:Art[íi]culo|ART[ÍI]CULO)\s+(?<base>\d+)(?:\s*(?<ord>[oº°]))?(?:(?:\.-|-)(?<letra>[A-Z])(?!\p{L}))?(?:[\s-]+(?<latino>${SUFIJOS_LATINOS})(?:\s+(?<letra2>[A-Z])(?=\s*[.\-–—]))?)?\s*[.\-–—]`,
  "u",
);

/** Clave canónica, independiente de cómo escriba el PDF: "82 Bis", "4o-A", "29-A", "1o". */
function numeroCanonico(g: Record<string, string | undefined>): string {
  const latino = g.latino ? g.latino.charAt(0).toUpperCase() + g.latino.slice(1).toLowerCase() : "";
  return (
    g.base +
    (g.ord ? "o" : "") +
    (g.letra ? `-${g.letra}` : "") +
    (latino ? ` ${latino}` : "") +
    (g.letra2 ? ` ${g.letra2}` : "")
  );
}

// Línea completa: "Transitorios", "TRANSITORIOS", "ARTÍCULOS TRANSITORIOS". Anclada al final de la
// línea para no cortar en un renglón de texto que mencione "el artículo transitorio Tercero".
const TRANSITORIOS = /^\s*(?:ART[ÍI]CULOS?\s+)?TRANSITORIOS?\s*$/i;

/**
 * Divide el texto plano de una ley en artículos. Se detiene al llegar a los
 * transitorios: su numeración ("Primero", "Segundo") reinicia, no es citable como parte
 * del articulado vigente, y los decretos de reforma que siguen citan artículos de otras leyes.
 */
export function parseArticulos(textoLey: string): ArticuloParseado[] {
  const articulos: ArticuloParseado[] = [];
  let actual: { numero: string; lineas: string[] } | null = null;

  const cerrar = () => {
    if (!actual) return;
    articulos.push({
      numero: actual.numero,
      texto: actual.lineas.join("\n").trim(),
    });
    actual = null;
  };

  for (const linea of textoLey.replace(/\r\n/g, "\n").split("\n")) {
    if (TRANSITORIOS.test(linea)) {
      cerrar();
      break;
    }
    const m = ENCABEZADO.exec(linea);
    if (m?.groups) {
      cerrar();
      actual = { numero: numeroCanonico(m.groups), lineas: [linea.trim()] };
    } else if (actual) {
      actual.lineas.push(linea);
    }
  }
  cerrar();
  return articulos;
}
