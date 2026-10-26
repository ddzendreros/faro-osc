"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La cita lista para pegar en un oficio o informe. El texto se ve sin JavaScript; el botón solo
 * lo copia al portapapeles y enciende la cita un momento.
 */
export function Cita({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"reposo" | "copiada" | "error">("reposo");
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiada");
    } catch {
      setEstado("error");
    }
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado("reposo"), 2200);
  }

  return (
    <div className="cita" data-copiada={estado === "copiada"}>
      <code>{texto}</code>
      <button type="button" onClick={copiar}>
        {estado === "copiada" ? "Copiada" : estado === "error" ? "No se pudo copiar" : "Copiar cita"}
      </button>
      <span className="solo-lectores" role="status">
        {estado === "copiada" ? "Cita copiada al portapapeles" : ""}
      </span>
    </div>
  );
}
