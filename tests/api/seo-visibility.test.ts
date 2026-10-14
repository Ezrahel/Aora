// ============================================================
// SEO + AI-agent visibility smoke
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

const root = process.cwd();

describe("SEO + AI visibility", () => {
  it("index.html has AI discovery + FAQ/HowTo JSON-LD, no fake contacts", () => {
    const html = readFileSync(join(root, "index.html"), "utf-8");
    expect(html).toContain("/llms.txt");
    expect(html).toContain("/.well-known/ai-plugin.json");
    expect(html).toContain('"@type": "FAQPage"');
    expect(html).toContain('"@type": "HowTo"');
    expect(html).toContain('"@type": "BreadcrumbList"');
    expect(html).not.toContain("+234-XXX");
    expect(html).not.toContain("/og-image.png");
    expect(html).not.toContain("/logo.png");
  });

  it("seo.ts has no missing og-*/logo assets, escapeHtml is correct", () => {
    const src = readFileSync(join(root, "src/lib/seo.ts"), "utf-8");
    expect(src).not.toMatch(/\/og-[a-z-]+\.png/);
    expect(src).toContain("&amp;");
    expect(src).toContain("&lt;");
    expect(src).toContain("aorahq-logo.png");
    expect(src).not.toContain("+234-1-000-0000");
  });

  it("public crawler files exist and sitemap has no private routes", () => {
    for (const f of ["llms.txt", "ai.txt", "humans.txt", "openapi.json", "robots.txt", "sitemap.xml", "sitemap-index.xml", "sitemap-docs.xml"]) {
      expect(existsSync(join(root, "public", f)), f).toBe(true);
    }
    expect(existsSync(join(root, "public", ".well-known", "ai-plugin.json"))).toBe(true);
    const sitemap = readFileSync(join(root, "public", "sitemap.xml"), "utf-8");
    for (const priv of ["/dashboard", "/settings", "/portal", "/catalog", "/customers", "/subscriptions"]) {
      expect(sitemap).not.toContain(`<loc>https://aorahq.com${priv}</loc>`);
    }
    expect(sitemap).toContain("/llms.txt");
    const robots = readFileSync(join(root, "public", "robots.txt"), "utf-8");
    expect(robots).not.toContain("sitemap-blog.xml");
    const llms = readFileSync(join(root, "public", "llms.txt"), "utf-8");
    expect(llms).toContain("AoraHQ");
    expect(llms).toContain("/api/ai-summary");
  });

  it("GET /api/ai-summary returns machine-readable JSON", async () => {
    const { default: app } = await import("../../src/app.ts");
    const server = app.listen(0);
    await new Promise<void>((r) => server.on("listening", () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/ai-summary`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.name).toBe("AoraHQ");
      expect(body.llms_txt).toContain("llms.txt");
      expect(Array.isArray(body.key_endpoints)).toBe(true);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }, 60_000);

  it("GET /llms.txt serves plain text (dist/public fallback)", async () => {
    const { default: app } = await import("../../src/app.ts");
    const server = app.listen(0);
    await new Promise<void>((r) => server.on("listening", () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/llms.txt`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      const text = await res.text();
      expect(text).toContain("AoraHQ");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }, 60_000);
});
