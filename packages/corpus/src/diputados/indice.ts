export interface LeyIndice {
  /** Nombre del archivo PDF en Diputados: casi siempre una sigla ("LFFAOSC") pero a veces numérico ("79"). */
  codigo: string;
  nombre: string;
  /** Fecha de publicación original en el DOF (YYYY-MM-DD). */
  publicadaDof: string | null;
  /** Fecha de la última reforma en el DOF (YYYY-MM-DD); null si "Sin reforma". */
  ultimaReforma: string | null;
}

/**
 * El HTML de Diputados declara charset=utf-8 pero se sirve en ISO-8859-1/Windows-1252.
 * Decodificarlo como UTF-8 corrompe los acentos.
 */
export function decodificarHtmlDiputados(bytes: Uint8Array): string {
  return new TextDecoder("windows-1252").decode(bytes);
}

const FECHA_DOF = /DOF\s+(\d{2})\/(\d{2})\/(\d{4})/;

function fechaDof(html: string): string | null {
  const m = FECHA_DOF.exec(html);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function textoPlano(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae las leyes del listado "Leyes Federales Vigentes". Cada ley es una fila con
 * celdas: número | nombre + fecha original | fecha de última reforma | enlaces al texto.
 * Las filas que no tienen esa forma (p. ej. la CPEUM, que anida una tabla) se omiten.
 */
export function parseIndiceDiputados(html: string): LeyIndice[] {
  const leyes: LeyIndice[] = [];
  for (const fila of html.split(/(?=<tr[\s>])/i)) {
    const celdas = fila.split(/<td\b/i).slice(1);
    if (celdas.length < 4) continue;
    const [, celdaNombre, celdaReforma, celdaEnlaces] = celdas as [string, string, string, string];

    const codigo = /href="pdf\/([A-Za-z0-9_]+)\.pdf"/i.exec(celdaEnlaces)?.[1];
    const enlaceNombre = /<a\b[^>]*href="ref\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i.exec(celdaNombre)?.[1];
    if (!codigo || !enlaceNombre) continue;

    leyes.push({
      codigo,
      nombre: textoPlano(enlaceNombre),
      publicadaDof: fechaDof(celdaNombre),
      ultimaReforma: fechaDof(celdaReforma),
    });
  }
  return leyes;
}
