import { createHash } from "node:crypto";
import { parseArticulos, type ArticuloParseado } from "../parse-articulos.js";
import { limpiarPaginasDiputados } from "./limpiar-paginas.js";
import { extraerPaginasPdf } from "./pdf.js";

export interface LeyProcesada {
  articulos: ArticuloParseado[];
  /** Hash del texto limpio: si no cambia, no hay nada que diffear. */
  sha256: string;
}

export async function procesarPdfLey(bytes: Uint8Array): Promise<LeyProcesada> {
  const texto = limpiarPaginasDiputados(await extraerPaginasPdf(bytes));
  return {
    articulos: parseArticulos(texto),
    sha256: createHash("sha256").update(texto).digest("hex"),
  };
}
