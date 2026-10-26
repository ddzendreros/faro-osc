import type { Metadata } from "next";
import Link from "next/link";
import { FormularioBusqueda } from "../../components/FormularioBusqueda";
import { buscador } from "../../lib/corpus";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

async function consulta(searchParams: Props["searchParams"]) {
  const { q } = await searchParams;
  return (Array.isArray(q) ? q[0] : q)?.slice(0, 200).trim() ?? "";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await consulta(searchParams);
  return { title: q ? `Resultados de «${q}»` : "Buscar", robots: { index: false } };
}

export default async function Buscar({ searchParams }: Props) {
  const q = await consulta(searchParams);
  const resultados = q ? buscador.buscar(q, 25) : [];

  return (
    <>
      <div className="encabezado-pagina">
        <h1>{q ? `Resultados de «${q}»` : "Buscar en las leyes"}</h1>
        <FormularioBusqueda valor={q} />
        {q && resultados.length > 0 && (
          <p style={{ marginTop: "1rem" }}>
            {resultados.length === 25 ? "Los 25 más relevantes" : `${resultados.length} ${resultados.length === 1 ? "artículo" : "artículos"}`}.
            La búsqueda es por palabras clave, no entiende preguntas completas.
          </p>
        )}
      </div>

      {resultados.length > 0 && (
        <ol className="resultados" aria-label="Resultados">
          {resultados.map((r) => (
            <li key={`${r.ley}-${r.slug}`}>
              <Link className="resultado" href={`/leyes/${r.ley}/${r.slug}`} data-exacto={r.exacto}>
                <div className="margen">
                  <small>{r.ley}</small>
                  {r.numero}
                </div>
                <p className="resultado__fragmento">
                  {r.fragmento.map((s, i) => (s.resaltado ? <mark key={i}>{s.texto}</mark> : <span key={i}>{s.texto}</span>))}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {q && resultados.length === 0 && (
        <div className="vacio">
          <p>No hay artículos con «{q}» en las cinco leyes de la demo.</p>
          <ul>
            <li>Prueba con una sola palabra clave, como «donativos» o «registro».</li>
            <li>Para ir directo a un artículo escribe la ley y el número: «LISR 82» o «CFF 29-A».</li>
            <li>
              Si buscas una ley que no está, revisa <Link href="/#leyes">cuáles incluye la demo</Link>.
            </li>
          </ul>
        </div>
      )}

      {!q && (
        <div className="vacio">
          <p>Escribe palabras clave o una referencia directa:</p>
          <ul>
            <li>«donativos deducibles» busca en el texto de todas las leyes.</li>
            <li>«LISR 82 Bis» abre ese artículo.</li>
          </ul>
        </div>
      )}
    </>
  );
}
