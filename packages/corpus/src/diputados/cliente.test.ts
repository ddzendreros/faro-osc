import { describe, expect, it, vi } from "vitest";
import { descargarPdfLey } from "./cliente.js";

const pdf = () => new Response(new TextEncoder().encode("%PDF-1.7 contenido"), { status: 200 });

describe("descargarPdfLey: tolerancia a fallos del sitio", () => {
  it("reintenta cuando la conexión se corta ('terminated') y termina entregando el PDF", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("terminated"))
      .mockResolvedValueOnce(new Response("error", { status: 503 }))
      .mockResolvedValueOnce(pdf());
    const bytes = await descargarPdfLey("LISR", f);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    expect(f).toHaveBeenCalledTimes(3);
  }, 15_000);

  it("no reintenta un 404: no se arregla solo", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(new Response("no existe", { status: 404 }));
    await expect(descargarPdfLey("NOEXISTE", f)).rejects.toThrow(/404/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("rechaza lo que no es un PDF aunque el servidor responda 200", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(new Response("<html>mantenimiento</html>", { status: 200 }));
    await expect(descargarPdfLey("LISR", f)).rejects.toThrow(/no es un PDF/);
  });

  it("rechaza códigos con caracteres que no pertenecen a un nombre de archivo", async () => {
    const f = vi.fn<typeof fetch>();
    await expect(descargarPdfLey("../../etc/passwd", f)).rejects.toThrow(/inválido/);
    expect(f).not.toHaveBeenCalled();
  });
});
