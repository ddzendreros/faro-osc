import { descargarDecretos, descargarIndice, descargarPdfLey, LEYES_MVP, procesarPdfLey } from "@faro/corpus";
import { crearDb, schema } from "@faro/db";
import { embeddingsDesdeEnv } from "@faro/providers";
import { eq } from "drizzle-orm";
import { embeberPendientes } from "./embeber.js";
import { ingestarLey } from "./ingestar.js";
import { aprobarReforma, rechazarReforma } from "./revision.js";

const USO = `Uso (requiere DATABASE_URL con el rol dueño de las tablas, no faro_app):
  ingest [CODIGO...]   Descarga las leyes de Diputados y las lleva a la base (por defecto, las del MVP)
  embeber              Calcula los embeddings que falten (EMBEDDINGS_BASE_URL, EMBEDDINGS_MODEL, EMBEDDINGS_DIMS; por defecto Ollama + bge-m3)
  pendientes           Lista las reformas esperando revisión
  aprobar <reformaId>  Publica una reforma pendiente
  rechazar <reformaId> Descarta una reforma pendiente`;

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  const [comando, ...args] = process.argv.slice(2);
  if (!comando || !["ingest", "embeber", "pendientes", "aprobar", "rechazar"].includes(comando)) {
    console.error(USO);
    return 2;
  }
  if (!url) {
    console.error("Falta DATABASE_URL.\n\n" + USO);
    return 2;
  }
  const { db, cerrar } = crearDb(url);
  try {
    if (comando === "embeber") {
      const proveedor = embeddingsDesdeEnv();
      console.log(`Embeddings con ${proveedor.modelo} (${proveedor.dimensiones} dimensiones)…`);
      console.log(`${await embeberPendientes(db, proveedor)} artículos procesados`);
      return 0;
    }

    if (comando === "pendientes") {
      const filas = await db
        .select({ id: schema.reformas.id, ley: schema.leyes.abreviatura, fecha: schema.reformas.fechaDof, diff: schema.reformas.diff })
        .from(schema.reformas)
        .innerJoin(schema.leyes, eq(schema.leyes.id, schema.reformas.leyId))
        .where(eq(schema.reformas.estado, "pendiente"));
      if (!filas.length) console.log("No hay reformas pendientes.");
      for (const f of filas) {
        const d = f.diff as { agregados: unknown[]; modificados: unknown[]; eliminados: unknown[] };
        console.log(`${f.id}  ${f.ley}  ${f.fecha}  +${d.agregados.length} ~${d.modificados.length} -${d.eliminados.length}`);
      }
      return 0;
    }

    if (comando === "aprobar" || comando === "rechazar") {
      const id = args[0];
      if (!id) {
        console.error(USO);
        return 2;
      }
      if (comando === "aprobar") console.log(await aprobarReforma(db, id));
      else await rechazarReforma(db, id);
      console.log(`Reforma ${id}: ${comando === "aprobar" ? "aprobada" : "rechazada"}`);
      return 0;
    }

    const indice = new Map((await descargarIndice()).map((l) => [l.codigo, l]));
    let fallo = false;
    for (const codigo of args.length ? args : [...LEYES_MVP]) {
      try {
        const ley = indice.get(codigo);
        if (!ley) throw new Error("no aparece en el índice de Diputados");
        const fechaVigencia = ley.ultimaReforma ?? ley.publicadaDof;
        if (!fechaVigencia) throw new Error("el índice no trae fecha de reforma ni de publicación");
        const { articulos, sha256 } = await procesarPdfLey(await descargarPdfLey(codigo));
        // Solo informativo: si la página de historial falla, la ingesta sigue sin enlace al decreto.
        const decretos = await descargarDecretos(ley).catch(() => []);
        const r = await ingestarLey(db, {
          codigo,
          nombre: ley.nombre,
          abreviatura: /^\d+$/.test(codigo) ? ley.nombre : codigo,
          fuenteUrl: `https://www.diputados.gob.mx/LeyesBiblio/pdf/${codigo}.pdf`,
          fechaVigencia,
          urlReforma: decretos.find((d) => d.fecha === fechaVigencia)?.url,
          articulos,
          textoSha256: sha256,
        });
        console.log(`${codigo.padEnd(9)} ${JSON.stringify(r)}`);
      } catch (e) {
        fallo = true;
        console.error(`${codigo.padEnd(9)} ERROR: ${e instanceof Error ? e.message : e}`);
      }
    }
    return fallo ? 1 : 0;
  } finally {
    await cerrar();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
