export interface DecretoReforma {
  /** Fecha de publicación en el DOF (YYYY-MM-DD). */
  fecha: string;
  /** URL absoluta del PDF del decreto, alojado por la Cámara de Diputados. */
  url: string;
}

const BASE = "https://www.diputados.gob.mx/LeyesBiblio/";

// <a target="_blank" href="lffaosc/LFFAOSC_ref07_01abr24.pdf">DOF \n 01-04-2024</a>
// El texto del enlace puede partirse en varias líneas.
const ENLACE_DECRETO = /<a\b[^>]*href="([^"]+\.pdf)"[^>]*>\s*DOF\s+(\d{2})-(\d{2})-(\d{4})/gi;

/**
 * Lee la página de historial de una ley (`ref/<ley>.htm`) y devuelve los decretos que la crearon
 * o reformaron, uno por fecha. Sirve para que quien revisa una reforma pendiente pueda ir a la
 * fuente oficial del cambio.
 */
export function parseDecretosRef(html: string, refPagina: string): DecretoReforma[] {
  const porFecha = new Map<string, DecretoReforma>();
  for (const m of html.matchAll(ENLACE_DECRETO)) {
    const [, href, dd, mm, aaaa] = m as unknown as [string, string, string, string, string];
    const fecha = `${aaaa}-${mm}-${dd}`;
    if (!porFecha.has(fecha)) porFecha.set(fecha, { fecha, url: new URL(href, BASE + refPagina).href });
  }
  return [...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
