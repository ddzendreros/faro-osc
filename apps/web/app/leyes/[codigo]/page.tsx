import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leyes, leyPorCodigo } from "../../../lib/corpus";
import { fechaLarga } from "../../../lib/formato";

type Props = { params: Promise<{ codigo: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return leyes.map((l) => ({ codigo: l.codigo }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ley = leyPorCodigo((await params).codigo);
  return { title: ley ? `${ley.codigo}: ${ley.titulo}` : "Ley no encontrada" };
}

export default async function Ley({ params }: Props) {
  const ley = leyPorCodigo((await params).codigo);
  if (!ley) notFound();

  return (
    <>
      <div className="encabezado-pagina">
        <h1>{ley.titulo}</h1>
        <p>
          {ley.codigo}
          {ley.ultimaReforma ? `. Texto consolidado a la reforma publicada el ${fechaLarga(ley.ultimaReforma)}.` : "."}
        </p>
        <ul className="metadatos">
          <li>{ley.articulos.length} artículos</li>
          <li>
            <a href={ley.fuenteUrl}>PDF oficial de la Cámara de Diputados</a>
          </li>
          {ley.urlDecreto && (
            <li>
              <a href={ley.urlDecreto}>Decreto de la última reforma</a>
            </li>
          )}
        </ul>
      </div>

      <nav aria-label={`Artículos de ${ley.codigo}`}>
        <ul className="indice">
          {ley.articulos.map((a) => (
            <li key={a.slug}>
              <Link href={`/leyes/${ley.codigo}/${a.slug}`} aria-label={`Artículo ${a.numero}`}>
                {a.numero}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
