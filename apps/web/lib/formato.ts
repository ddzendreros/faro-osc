/** Letras acentuadas a su base, una por una: la longitud no cambia, así que los índices se conservan. */
export function plegar(texto: string): string {
  return texto
    .normalize("NFC")
    .toLowerCase()
    .replace(/[À-ɏ]/g, (c) => c.normalize("NFD")[0] ?? c);
}

/** "82 Bis" -> "82-bis", "4o-A" -> "4o-a", "82 Quáter" -> "82-quater". Apto para URL. */
export function slugNumero(numero: string): string {
  return plegar(numero).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** "Ley del Impuesto…" en lugar de "LEY del Impuesto…": Diputados escribe la primera palabra en mayúsculas. */
export function tituloLey(nombre: string): string {
  const [primera = "", ...resto] = nombre.split(" ");
  return [primera.charAt(0).toUpperCase() + primera.slice(1).toLowerCase(), ...resto].join(" ");
}

const fechaLargaFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "2024-04-01" -> "1 de abril de 2024". UTC para que la zona horaria no corra el día. */
export function fechaLarga(iso: string): string {
  return fechaLargaFmt.format(new Date(`${iso}T00:00:00Z`));
}

/** "2024-04-01" -> "01/04/2024". */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** La cita que el agente usará: ley, artículo y a qué fecha corresponde el texto. */
export function cita(ley: string, numero: string, fechaTexto: string | null): string {
  const fecha = fechaTexto ? `, texto al ${fechaCorta(fechaTexto)}` : "";
  return `[${ley} art. ${numero}${fecha}]`;
}

export interface Parrafo {
  texto: string;
  /** Fracciones e incisos van sangrados: "I.", "a)", "1.". */
  sangrado: boolean;
  /** Nota editorial de Diputados ("Artículo adicionado DOF 30-11-2016"): no es texto de la ley. */
  nota: boolean;
}

// Notas cortas que registran una reforma. Un falso positivo solo atenúa el estilo, nunca oculta texto.
const NOTA_REFORMA =
  /^(?=.*\bDOF\s+\d{2}-\d{2}-\d{4})(?=.*(?:reformad|adicionad|derogad|modificad|recorrid|declarad|erratas|actualizad|compilad))/i;
const esNota = (t: string) => t.length < 260 && NOTA_REFORMA.test(t);
const ABRE_NOTA = /^(?:Art[íi]culo|P[áa]rrafo|Fracci[oó]n|Inciso|Apartado|Denominaci[oó]n|Ep[íi]grafe|Numeral|Base|Cap[íi]tulo|T[íi]tulo|Secci[oó]n)\b/;

// "Artículo 82-Bis." / "Artículo 4o.-A.-" al inicio; el número ya se muestra en el margen.
const ROTULO = /^(?:Art[íi]culo|ART[ÍI]CULO)\s+[0-9A-Za-zº°ÁÉÍÓÚáéíóúñ\s.\-–—]*?(?<=[.\-–—])\s+(?=[A-ZÁÉÍÓÚÑ(¿"“])/;
const FRACCION = /^(?:[IVXLC]+\.[-–—]?\s|[a-z]\)\s|\d+\.[-–—]?\s|\d+\)\s|[A-Z]\.\s)/;

/**
 * El PDF trae el texto cortado en renglones de ancho fijo. Se vuelve a unir en párrafos: un renglón
 * empieza un párrafo nuevo si abre una fracción o inciso, o si el anterior cerró con punto o dos
 * puntos y este empieza con mayúscula.
 */
export function parrafos(texto: string): Parrafo[] {
  const lineas = texto.replace(ROTULO, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const salida: Parrafo[] = [];
  for (const linea of lineas) {
    const previo = salida.at(-1);
    const esFraccion = FRACCION.test(linea);
    const cierraPrevio = previo ? /[.:]$/.test(previo.texto) && /^[A-ZÁÉÍÓÚÑ("“¿]/.test(linea) : false;
    // Las notas de reforma no terminan en punto: cada una abre su propio párrafo.
    const abreNota = ABRE_NOTA.test(linea) && esNota(linea);
    if (!previo || esFraccion || cierraPrevio || abreNota) salida.push({ texto: linea, sangrado: esFraccion, nota: false });
    else previo.texto += ` ${linea}`;
  }
  // La nota se decide con el párrafo ya completo: un renglón suelto no alcanza a mostrar la fecha.
  for (const p of salida) p.nota = !p.sangrado && esNota(p.texto);
  return salida;
}
