export interface ProveedorEmbeddings {
  /** Identificador del modelo; se guarda junto a cada vector para saber cuándo reindexar. */
  modelo: string;
  dimensiones: number;
  embeber(textos: string[]): Promise<number[][]>;
}

export interface OpcionesCompatibleOpenAI {
  /** Incluye la versión: "http://localhost:11434/v1" (Ollama), "https://api.openai.com/v1". */
  baseUrl: string;
  modelo: string;
  dimensiones: number;
  apiKey?: string;
  fetch?: typeof fetch;
  /** Reintentos ante 429 y 5xx (por defecto 3 intentos en total). */
  intentos?: number;
  /** Se inyecta en pruebas para no esperar de verdad. */
  esperar?: (ms: number) => Promise<void>;
}

interface RespuestaEmbeddings {
  data?: { index: number; embedding: number[] }[];
}

const esperarReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Proveedor para cualquier servicio con el endpoint `POST /embeddings` al estilo OpenAI: Ollama
 * (local, sin costo), OpenAI y los muchos servicios que lo imitan. Así el modelo es configuración,
 * no código.
 */
export function embeddingsCompatibleOpenAI(o: OpcionesCompatibleOpenAI): ProveedorEmbeddings {
  const llamar = o.fetch ?? fetch;
  const intentos = o.intentos ?? 3;
  const esperar = o.esperar ?? esperarReal;
  const url = `${o.baseUrl.replace(/\/+$/, "")}/embeddings`;

  async function pedir(textos: string[]): Promise<Response> {
    let ultimo: Response | undefined;
    for (let i = 0; i < intentos; i++) {
      ultimo = await llamar(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(o.apiKey ? { authorization: `Bearer ${o.apiKey}` } : {}) },
        body: JSON.stringify({ model: o.modelo, input: textos }),
        signal: AbortSignal.timeout(60_000),
      });
      const reintentable = ultimo.status === 429 || ultimo.status >= 500;
      if (ultimo.ok || !reintentable) return ultimo;
      if (i < intentos - 1) await esperar(500 * 2 ** i);
    }
    return ultimo as Response;
  }

  return {
    modelo: o.modelo,
    dimensiones: o.dimensiones,
    async embeber(textos) {
      if (textos.length === 0) return [];
      const res = await pedir(textos);
      if (!res.ok) {
        // Solo el estado y un fragmento del cuerpo: nunca se imprimen las cabeceras (llevan la llave).
        throw new Error(`Embeddings: ${url} respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const datos = ((await res.json()) as RespuestaEmbeddings).data;
      if (!datos || datos.length !== textos.length) {
        throw new Error(`Embeddings: se pidieron ${textos.length} vectores y llegaron ${datos?.length ?? 0}`);
      }
      // La API no garantiza el orden; el índice sí.
      const vectores = [...datos].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      for (const v of vectores) {
        if (v.length !== o.dimensiones) {
          throw new Error(
            `Embeddings: el modelo ${o.modelo} devolvió ${v.length} dimensiones y se esperaban ${o.dimensiones}`,
          );
        }
      }
      return vectores;
    },
  };
}

/**
 * Lee la configuración del entorno. Por defecto apunta a Ollama local con bge-m3 (1024
 * dimensiones, las del esquema), que no requiere cuenta ni llave.
 */
export function embeddingsDesdeEnv(env: Record<string, string | undefined> = process.env): ProveedorEmbeddings {
  const dimensiones = Number(env.EMBEDDINGS_DIMS ?? 1024);
  if (!Number.isInteger(dimensiones) || dimensiones <= 0) throw new Error("EMBEDDINGS_DIMS debe ser un entero positivo");
  return embeddingsCompatibleOpenAI({
    baseUrl: env.EMBEDDINGS_BASE_URL ?? "http://localhost:11434/v1",
    modelo: env.EMBEDDINGS_MODEL ?? "bge-m3",
    dimensiones,
    apiKey: env.EMBEDDINGS_API_KEY,
  });
}
