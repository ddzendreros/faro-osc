const CAMARA = /^CÁMARA DE DIPUTADOS DEL H\. CONGRESO DE LA UNIÓN$/;
const NUM_PAGINA = /^\d+ de \d+$/;

/**
 * Cada página del PDF abre con un bloque fijo: título de la ley, "CÁMARA DE DIPUTADOS…",
 * "Secretaría General", "Secretaría de Servicios Parlamentarios", "Última Reforma DOF …"
 * y "N de M". Si no se quita, se pega al último artículo de la página anterior y cada
 * ingesta produciría falsos cambios (el número de página cambia con la paginación).
 *
 * Solo se busca el bloque en las primeras líneas de la página, así nunca se borra texto
 * del articulado.
 */
export function limpiarPaginasDiputados(paginas: string[]): string {
  return paginas
    .map((pagina) => {
      const lineas = pagina.normalize("NFC").replace(/\r\n/g, "\n").split("\n");
      const camara = lineas.slice(0, 4).findIndex((l) => CAMARA.test(l.trim()));
      if (camara === -1) return lineas.join("\n");
      const fin = lineas.slice(camara, camara + 7).findIndex((l) => NUM_PAGINA.test(l.trim()));
      if (fin === -1) return lineas.join("\n");
      return lineas.slice(camara + fin + 1).join("\n");
    })
    .join("\n");
}
