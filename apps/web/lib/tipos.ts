/** Forma del snapshot que genera `corpus exportar` (packages/corpus). */
export interface ArticuloSnapshot {
  /** Clave canónica del parser: "82", "82 Bis", "4o-A". */
  numero: string;
  texto: string;
  tags: string[];
}

export interface LeySnapshot {
  /** Nombre del PDF en Diputados; para las leyes de la demo es la sigla ("LISR"). */
  codigo: string;
  nombre: string;
  fuenteUrl: string;
  /** Fecha (YYYY-MM-DD) de la última reforma en el DOF; el texto es el consolidado a esa fecha. */
  ultimaReforma: string | null;
  urlDecreto: string | null;
  articulos: ArticuloSnapshot[];
}

export interface Snapshot {
  /** Día (YYYY-MM-DD) en que se descargó el texto de Diputados. */
  generadoEn: string;
  leyes: LeySnapshot[];
}
