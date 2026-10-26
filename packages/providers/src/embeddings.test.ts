import { describe, expect, it, vi } from "vitest";
import { embeddingsCompatibleOpenAI, embeddingsDesdeEnv } from "./embeddings.js";

const vec = (n: number, valor = 0.1) => Array.from({ length: n }, () => valor);
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
const base = { baseUrl: "http://ollama.test/v1/", modelo: "bge-m3", dimensiones: 3, esperar: async () => {} };

describe("embeddingsCompatibleOpenAI", () => {
  it("manda el modelo y los textos al endpoint /embeddings", async () => {
    const f = vi.fn(async () => json({ data: [{ index: 0, embedding: vec(3) }] }));
    await embeddingsCompatibleOpenAI({ ...base, fetch: f }).embeber(["hola"]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://ollama.test/v1/embeddings");
    expect(JSON.parse(init.body as string)).toEqual({ model: "bge-m3", input: ["hola"] });
  });

  it("devuelve los vectores en el orden de los textos aunque la API los desordene", async () => {
    const f = async () =>
      json({ data: [{ index: 1, embedding: vec(3, 2) }, { index: 0, embedding: vec(3, 1) }] });
    const r = await embeddingsCompatibleOpenAI({ ...base, fetch: f }).embeber(["a", "b"]);
    expect(r.map((v) => v[0])).toEqual([1, 2]);
  });

  it("solo manda la llave cuando hay una", async () => {
    const f = vi.fn(async () => json({ data: [{ index: 0, embedding: vec(3) }] }));
    await embeddingsCompatibleOpenAI({ ...base, fetch: f }).embeber(["x"]);
    await embeddingsCompatibleOpenAI({ ...base, apiKey: "secreta", fetch: f }).embeber(["x"]);
    const cab = (i: number) => (f.mock.calls[i] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(cab(0).authorization).toBeUndefined();
    expect(cab(1).authorization).toBe("Bearer secreta");
  });

  it("rechaza vectores con dimensiones distintas a las del esquema", async () => {
    const f = async () => json({ data: [{ index: 0, embedding: vec(768) }] });
    await expect(embeddingsCompatibleOpenAI({ ...base, fetch: f }).embeber(["x"])).rejects.toThrow(/768 dimensiones.*3/);
  });

  it("rechaza una respuesta con menos vectores que textos", async () => {
    const f = async () => json({ data: [{ index: 0, embedding: vec(3) }] });
    await expect(embeddingsCompatibleOpenAI({ ...base, fetch: f }).embeber(["a", "b"])).rejects.toThrow(/2 vectores y llegaron 1/);
  });

  it("reintenta ante 429 y 5xx, y se rinde tras los intentos", async () => {
    let n = 0;
    const f = vi.fn(async () => (++n < 3 ? json({ error: "ocupado" }, 429) : json({ data: [{ index: 0, embedding: vec(3) }] })));
    await expect(embeddingsCompatibleOpenAI({ ...base, fetch: f }).embeber(["x"])).resolves.toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(3);

    const siempreCae = vi.fn(async () => json({ error: "caído" }, 503));
    await expect(embeddingsCompatibleOpenAI({ ...base, fetch: siempreCae }).embeber(["x"])).rejects.toThrow(/503/);
    expect(siempreCae).toHaveBeenCalledTimes(3);
  });

  it("no reintenta un error del cliente (p. ej. llave inválida) y no filtra la llave", async () => {
    const f = vi.fn(async () => json({ error: "llave inválida" }, 401));
    const p = embeddingsCompatibleOpenAI({ ...base, apiKey: "sk-super-secreta", fetch: f });
    const error = await p.embeber(["x"]).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/401/);
    expect((error as Error).message).not.toContain("sk-super-secreta");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("una lista vacía no llama a la red", async () => {
    const f = vi.fn();
    expect(await embeddingsCompatibleOpenAI({ ...base, fetch: f }).embeber([])).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("embeddingsDesdeEnv", () => {
  it("por defecto usa Ollama local con bge-m3 y 1024 dimensiones", () => {
    expect(embeddingsDesdeEnv({})).toMatchObject({ modelo: "bge-m3", dimensiones: 1024 });
  });

  it("toma modelo y dimensiones del entorno", () => {
    expect(embeddingsDesdeEnv({ EMBEDDINGS_MODEL: "otro", EMBEDDINGS_DIMS: "768" })).toMatchObject({
      modelo: "otro",
      dimensiones: 768,
    });
  });

  it("rechaza dimensiones inválidas", () => {
    expect(() => embeddingsDesdeEnv({ EMBEDDINGS_DIMS: "abc" })).toThrow(/entero positivo/);
  });
});
