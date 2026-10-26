import { descargarIndice, descargarPdfLey } from "./diputados/cliente.js";
import { procesarPdfLey } from "./diputados/ingesta.js";
import { LEYES_MVP } from "./leyes-mvp.js";

/** Avisos que apuntan a un parseo defectuoso: números repetidos o articulado casi vacío. */
function chequear(articulos: { numero: string; texto: string }[]): string[] {
  const avisos: string[] = [];
  const vistos = new Set<string>();
  for (const a of articulos) {
    if (vistos.has(a.numero)) avisos.push(`número repetido: ${a.numero}`);
    vistos.add(a.numero);
  }
  if (articulos.length < 5) avisos.push(`solo ${articulos.length} artículos`);
  return avisos;
}

async function main(): Promise<number> {
  const [comando, ...args] = process.argv.slice(2);

  if (comando === "indice") {
    const indice = await descargarIndice();
    const porCodigo = new Map(indice.map((l) => [l.codigo, l]));
    console.log(`${indice.length} leyes en el índice de Diputados\n`);
    for (const codigo of LEYES_MVP) {
      const l = porCodigo.get(codigo);
      console.log(l ? `${codigo.padEnd(9)} reforma ${l.ultimaReforma ?? "—"}  ${l.nombre}` : `${codigo.padEnd(9)} NO ENCONTRADA en el índice`);
    }
    return 0;
  }

  if (comando === "ingest") {
    const codigos = args.length ? args : [...LEYES_MVP];
    let fallo = false;
    for (const codigo of codigos) {
      const { articulos, sha256 } = await procesarPdfLey(await descargarPdfLey(codigo));
      const avisos = chequear(articulos);
      const nums = articulos.map((a) => a.numero);
      console.log(
        `${codigo.padEnd(9)} ${String(articulos.length).padStart(4)} artículos  ${nums[0]} … ${nums.at(-1)}  sha256=${sha256.slice(0, 12)}` +
          (avisos.length ? `\n          AVISOS: ${avisos.join("; ")}` : ""),
      );
      if (avisos.length) fallo = true;
    }
    return fallo ? 1 : 0;
  }

  console.error("Uso: corpus indice | corpus ingest [CODIGO...]");
  return 2;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
