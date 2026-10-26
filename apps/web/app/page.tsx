import Link from "next/link";
import { Cita } from "../components/Cita";
import { FormularioBusqueda } from "../components/FormularioBusqueda";
import { articuloPorSlug, leyes } from "../lib/corpus";
import { cita, fechaLarga, parrafos } from "../lib/formato";

const EJEMPLOS = ["donativos deducibles", "LISR 82 Bis", "aviso de privacidad"];

export default function Portada() {
  // Un artículo real como muestra: se ve cómo queda la cita con su fecha.
  const muestra = articuloPorSlug("LISR", "82-bis");
  const primero = muestra ? (parrafos(muestra.articulo.texto)[0]?.texto ?? "") : "";
  const extracto = primero.length > 260 ? `${primero.slice(0, primero.lastIndexOf(" ", 260))}…` : primero;

  return (
    <>
      <section className="portada" aria-labelledby="titulo-portada">
        <div>
          <h1 id="titulo-portada">Busca en la ley y cita el artículo exacto.</h1>
          <p className="portada__bajada">
            Las leyes federales que rigen a las organizaciones de la sociedad civil en México, con el texto que publica la
            Cámara de Diputados. Esta demo busca y cita; todavía no responde preguntas con inteligencia artificial.
          </p>
          <FormularioBusqueda />
          <ul className="ejemplos" aria-label="Ejemplos de búsqueda">
            <li>Prueba con:</li>
            {EJEMPLOS.map((e) => (
              <li key={e}>
                <Link href={`/buscar?q=${encodeURIComponent(e)}`}>{e}</Link>
              </li>
            ))}
          </ul>
        </div>

        {muestra && (
          <article className="muestra" aria-label="Ejemplo de artículo citado">
            <div className="margen">
              <small>{muestra.ley.codigo}</small>
              {muestra.articulo.numero}
            </div>
            <div>
              <p className="muestra__texto">{extracto}</p>
              <Cita texto={cita(muestra.ley.codigo, muestra.articulo.numero, muestra.ley.ultimaReforma)} />
              <p style={{ margin: "1rem 0 0" }}>
                <Link href={`/leyes/${muestra.ley.codigo}/${muestra.articulo.slug}`}>Leer el artículo completo</Link>
              </p>
            </div>
          </article>
        )}
      </section>

      <section className="seccion" id="leyes" aria-labelledby="titulo-leyes">
        <h2 id="titulo-leyes">Leyes incluidas</h2>
        <table className="leyes">
          <caption className="solo-lectores">Leyes federales de la demo, con la fecha de su texto y su número de artículos</caption>
          <thead>
            <tr>
              <th scope="col">Ley</th>
              <th scope="col">Nombre</th>
              <th scope="col" className="oculta-movil">
                Texto al
              </th>
              <th scope="col" className="num">
                Artículos
              </th>
            </tr>
          </thead>
          <tbody>
            {leyes.map((l) => (
              <tr key={l.codigo}>
                <td>{l.codigo}</td>
                <td>
                  <Link href={`/leyes/${l.codigo}`}>{l.titulo}</Link>
                </td>
                <td className="oculta-movil">{l.ultimaReforma ? fechaLarga(l.ultimaReforma) : "sin dato"}</td>
                <td className="num">{l.articulos.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="seccion" aria-labelledby="titulo-limites">
        <h2 id="titulo-limites">Qué hace esta demo y qué no</h2>
        <div className="limites">
          <div>
            <h3>Ya funciona</h3>
            <ul>
              <li>Buscar por palabras o por artículo, por ejemplo «LISR 82 Bis».</li>
              <li>Leer cada artículo y copiar su cita con la fecha del texto.</li>
              <li>Ver de qué fecha es el texto de cada ley y abrir el PDF oficial.</li>
            </ul>
          </div>
          <div>
            <h3>Todavía no</h3>
            <ul>
              <li>Responder preguntas en lenguaje natural.</li>
              <li>Personalizar por organización ni avisar de reformas.</li>
              <li>Mostrar versiones anteriores de un artículo.</li>
            </ul>
          </div>
        </div>
        <p style={{ marginTop: "1.25rem" }}>
          <Link href="/acerca">Cómo está construido y qué sigue</Link>
        </p>
      </section>
    </>
  );
}
