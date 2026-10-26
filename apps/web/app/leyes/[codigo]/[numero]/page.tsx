import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cita } from "../../../../components/Cita";
import { articuloPorSlug, leyes } from "../../../../lib/corpus";
import { cita, fechaLarga, parrafos } from "../../../../lib/formato";

type Props = { params: Promise<{ codigo: string; numero: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return leyes.flatMap((l) => l.articulos.map((a) => ({ codigo: l.codigo, numero: a.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo, numero } = await params;
  const r = articuloPorSlug(codigo, numero);
  if (!r) return { title: "Artículo no encontrado" };
  const cuerpo = parrafos(r.articulo.texto)[0]?.texto ?? "";
  return {
    title: `${r.ley.codigo} art. ${r.articulo.numero}`,
    description: cuerpo.length > 155 ? `${cuerpo.slice(0, 152)}…` : cuerpo,
  };
}

export default async function Articulo({ params }: Props) {
  const { codigo, numero } = await params;
  const r = articuloPorSlug(codigo, numero);
  if (!r) notFound();
  const { ley, articulo, anterior, siguiente } = r;

  return (
    <article className="articulo">
      <div className="margen">
        <small>{ley.codigo}</small>
        {articulo.numero}
      </div>

      <div className="articulo__cuerpo">
        <h1>
          Artículo {articulo.numero}, <Link href={`/leyes/${ley.codigo}`}>{ley.titulo}</Link>
        </h1>
        <Cita texto={cita(ley.codigo, articulo.numero, ley.ultimaReforma)} />

        <div className="cuerpo-ley" style={{ marginTop: "1.75rem" }}>
          {parrafos(articulo.texto).map((p, i) => (
            <p key={i} data-sangrado={p.sangrado} data-nota={p.nota}>
              {p.texto}
            </p>
          ))}
        </div>

        {articulo.tags.length > 0 && (
          <ul className="temas" aria-label="Temas">
            {articulo.tags.map((t) => (
              <li key={t}>
                <Link href={`/buscar?q=${encodeURIComponent(t.replace(/_/g, " "))}`}>{t.replace(/_/g, " ")}</Link>
              </li>
            ))}
          </ul>
        )}

        <p className="nota">
          Texto consolidado de la Cámara de Diputados
          {ley.ultimaReforma ? `, a la reforma publicada el ${fechaLarga(ley.ultimaReforma)}` : ""}. Las notas sobre reformas
          que aparezcan dentro del artículo son parte del texto oficial. <a href={ley.fuenteUrl}>Ver el PDF completo</a>.
        </p>

        <nav className="vecinos" aria-label="Artículos contiguos">
          {anterior ? (
            <Link href={`/leyes/${ley.codigo}/${anterior.slug}`} rel="prev">
              Artículo {anterior.numero}
            </Link>
          ) : (
            <span />
          )}
          {siguiente && (
            <Link href={`/leyes/${ley.codigo}/${siguiente.slug}`} rel="next">
              Artículo {siguiente.numero}
            </Link>
          )}
        </nav>
      </div>
    </article>
  );
}
