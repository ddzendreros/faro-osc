import type { Metadata } from "next";
import Link from "next/link";
import { generadoEn, leyes } from "../../lib/corpus";
import { fechaLarga } from "../../lib/formato";

export const metadata: Metadata = { title: "Acerca de la demo" };

export default function Acerca() {
  const articulos = leyes.reduce((n, l) => n + l.articulos.length, 0);
  return (
    <>
      <div className="encabezado-pagina">
        <h1>Acerca de la demo</h1>
        <p>Qué es Faro OSC, de dónde sale el texto y qué falta para que sea un agente.</p>
      </div>

      <div className="prosa">
        <h2>Qué es</h2>
        <p>
          Faro OSC es un proyecto abierto para que cada organización de la sociedad civil en México tenga un agente que
          responda dudas legales citando el artículo exacto y la versión vigente de la ley, y que la avise cuando una reforma
          le afecte. Esta página es solo la primera pieza: el corpus legal, la búsqueda y la cita.
        </p>

        <h2>De dónde sale el texto</h2>
        <p>
          Del listado de Leyes Federales Vigentes de la Cámara de Diputados. Se descargó el PDF de cada ley el{" "}
          {fechaLarga(generadoEn)} y se separó en {articulos} artículos. Cada ley indica la fecha de la última reforma que
          incluye su texto. El PDF trae notas sobre reformas dentro de los artículos; se conservan porque son parte del texto
          oficial.
        </p>
        <p>
          La separación en artículos es automática y se validó contra las cinco leyes, pero puede equivocarse en casos raros.
          Ante cualquier duda, abre el PDF oficial que enlaza cada ley.
        </p>

        <h2>Qué falta</h2>
        <p>En este orden:</p>
        <ul>
          <li>
            Un agente que responda preguntas en lenguaje natural, con citas que se comprueban contra el corpus antes de mostrarse.
            Si no hay fundamento en la ley, dirá que no lo encontró.
          </li>
          <li>Un perfil por organización (figura jurídica, si es donataria, sus estatutos) para que las respuestas sean suyas.</li>
          <li>Avisos de reformas que le aplican a cada organización y un resumen semanal de cambios y noticias del sector.</li>
          <li>
            Más fuentes: los reglamentos de la Ley del Impuesto sobre la Renta y de la ley de fomento, la Resolución Miscelánea
            Fiscal y, después, leyes estatales.
          </li>
        </ul>

        <h2>Lo que ya existe en el código pero no se ve aquí</h2>
        <p>
          El repositorio ya incluye la ingesta de leyes con versionado por fecha (qué decía un artículo en cada momento), una
          cola de revisión humana para que ninguna reforma se publique sola, el aislamiento de los datos de cada organización y la
          generación de embeddings para búsqueda por significado. Tiene pruebas automáticas, pero aún no corre contra una base de
          datos de producción, por eso la demo usa una copia fija del texto.
        </p>

        <h2>Cómo citar</h2>
        <p>
          La cita incluye la ley, el artículo y la fecha del texto, por ejemplo «[LISR art. 82 Bis, texto al 01/04/2024]». La fecha
          importa porque la ley cambia: una cita sin ella no dice a qué versión se refiere.
        </p>
        <p>
          <Link href="/">Volver a buscar</Link>. El código y las pruebas están en{" "}
          <a href="https://github.com/ddzendreros/faro-osc">GitHub</a>.
        </p>
      </div>
    </>
  );
}
