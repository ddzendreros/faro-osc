/** Formulario GET simple: funciona sin JavaScript y deja la consulta en la URL para compartirla. */
export function FormularioBusqueda({ valor = "", id = "q" }: { valor?: string; id?: string }) {
  return (
    <form className="busqueda" action="/buscar" role="search">
      <label className="solo-lectores" htmlFor={id}>
        Buscar en las leyes
      </label>
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={valor}
        placeholder="donativos deducibles, LISR 82 Bis…"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit">Buscar</button>
    </form>
  );
}
