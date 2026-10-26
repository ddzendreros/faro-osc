import type { Metadata } from "next";
import { Bricolage_Grotesque, Literata } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Marca } from "../components/Marca";
import { generadoEn } from "../lib/corpus";
import { fechaLarga } from "../lib/formato";
import "./globals.css";

const ui = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-ui", display: "swap" });
const texto = Literata({ subsets: ["latin", "latin-ext"], variable: "--font-texto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Faro OSC: la ley con el artículo exacto", template: "%s | Faro OSC" },
  description:
    "Busca en las leyes federales que rigen a las organizaciones de la sociedad civil en México y cita el artículo exacto. Proyecto abierto, en construcción.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" className={`${ui.variable} ${texto.variable}`}>
      <body>
        <a className="saltar" href="#contenido">
          Saltar al contenido
        </a>
        <header className="cabecera">
          <div className="contenedor cabecera__fila">
            <Link className="marca" href="/" aria-label="Faro OSC, inicio">
              <Marca />
              Faro OSC
            </Link>
            <nav className="menu" aria-label="Principal">
              <Link href="/#leyes">Leyes</Link>
              <Link href="/acerca">Acerca de la demo</Link>
            </nav>
          </div>
        </header>
        <main id="contenido" className="contenedor">
          {children}
        </main>
        <footer className="pie">
          <div className="contenedor">
            <p>
              Esto no es asesoría legal. El texto es el consolidado que publica la Cámara de Diputados, descargado el{" "}
              {fechaLarga(generadoEn)}; las reformas posteriores pueden no estar. Verifica siempre en el Diario Oficial de la Federación.
            </p>
            <p>
              Proyecto de código abierto (AGPL-3.0).{" "}
              <a href="https://github.com/ddzendreros/faro-osc">Código en GitHub</a>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
