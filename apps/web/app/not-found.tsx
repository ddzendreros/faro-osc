import Link from "next/link";
import { FormularioBusqueda } from "../components/FormularioBusqueda";

export default function NoEncontrado() {
  return (
    <div className="encabezado-pagina">
      <h1>No existe esa página</h1>
      <p style={{ marginBottom: "1.25rem" }}>
        Puede que el artículo no esté en las cinco leyes de la demo. Busca por palabras o por referencia, o vuelve al{" "}
        <Link href="/">inicio</Link>.
      </p>
      <FormularioBusqueda id="q-404" />
    </div>
  );
}
