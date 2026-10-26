export { parseArticulos, type ArticuloParseado } from "./parse-articulos.js";
export { etiquetarArticulo } from "./etiquetas.js";
export { huellaArticulo, textoCanonico } from "./huella.js";
export { diffVersiones, type CambioArticulo, type DiffLey } from "./diff-versiones.js";
export {
  decodificarHtmlDiputados,
  parseIndiceDiputados,
  type LeyIndice,
} from "./diputados/indice.js";
export { limpiarPaginasDiputados } from "./diputados/limpiar-paginas.js";
export { descargarDecretos, descargarIndice, descargarPdfLey } from "./diputados/cliente.js";
export { parseDecretosRef, type DecretoReforma } from "./diputados/decretos.js";
export { procesarPdfLey, type LeyProcesada } from "./diputados/ingesta.js";
export { LEYES_MVP } from "./leyes-mvp.js";
