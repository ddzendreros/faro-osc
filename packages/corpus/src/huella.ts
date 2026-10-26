import { createHash } from "node:crypto";

/** Compara espacios y saltos de línea de forma tolerante: el reformateo del PDF no es una reforma. */
export const textoCanonico = (t: string): string => t.replace(/\s+/g, " ").trim();

/** Huella del contenido de un artículo, estable ante cambios de espaciado. */
export const huellaArticulo = (texto: string): string =>
  createHash("sha256").update(textoCanonico(texto)).digest("hex");
