export { parseArticulos, type ArticuloParseado } from "./parse-articulos.js";
export { huellaArticulo, textoCanonico } from "./huella.js";
export { diffVersiones, type CambioArticulo, type DiffLey } from "./diff-versiones.js";
export {
  decodificarHtmlDiputados,
  parseIndiceDiputados,
  type LeyIndice,
} from "./diputados/indice.js";
export { limpiarPaginasDiputados } from "./diputados/limpiar-paginas.js";
export { descargarIndice, descargarPdfLey } from "./diputados/cliente.js";
export { procesarPdfLey, type LeyProcesada } from "./diputados/ingesta.js";
export { LEYES_MVP } from "./leyes-mvp.js";
