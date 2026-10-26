/**
 * Etiquetas temáticas de un artículo, para cruzarlas con el perfil de cada OSC y decidir a quién
 * afecta una reforma.
 *
 * Es una heurística por palabras clave del texto, a propósito no por número de artículo (los
 * números cambian con las reformas). Prefiere pasarse de inclusiva: un falso positivo es una
 * alerta de más; un falso negativo es una OSC que no se entera de un cambio que le afecta.
 * Cualquier artículo que no se etiquete aquí sigue siendo consultable; solo no genera alertas por
 * perfil.
 */

const POR_TEXTO: [etiqueta: string, patron: RegExp][] = [
  ["donativos", /donativos?/i],
  ["donataria", /donatari[ao]s?|autorizadas? para recibir donativos/i],
  ["no_lucrativa", /fines no lucrativos|sin fines de lucro|no lucrativ[ao]s?/i],
  ["asistencial", /asistencia (social|privada)|asistencial/i],
  ["datos_personales", /datos personales/i],
  ["antilavado", /operaciones con recursos de procedencia il[ií]cita|actividades vulnerables|lavado de dinero/i],
  ["cfdi", /comprobantes? fiscal(es)? digital(es)?|cfdi/i],
  ["osc", /organizaciones de la sociedad civil/i],
];

/** Leyes cuyo objeto completo define el tema, sin importar el texto de cada artículo. */
const POR_LEY: Record<string, string[]> = {
  LFFAOSC: ["osc"],
  LFPIORPI: ["antilavado"],
  LFPDPPP: ["datos_personales"],
};

export function etiquetarArticulo(codigoLey: string, texto: string): string[] {
  const etiquetas = new Set<string>(POR_LEY[codigoLey] ?? []);
  for (const [etiqueta, patron] of POR_TEXTO) if (patron.test(texto)) etiquetas.add(etiqueta);
  return [...etiquetas].sort();
}
