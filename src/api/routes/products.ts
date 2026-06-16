// ============================================================
// Aora Billing OS — Products & Features Routes
// Both resource types live here; they share the workspace scope.
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, conflict, genId, toNum } from "../middleware.ts";
import type { Product, Feature } from "../types.ts";

const router = Router();

// ── Products ───────────────────────────────────────────────────

// GET /products — workspace-scoped; exclude archived when ?archived=false
router.get("/products", (req, res) => {
  const ws = resolveWorkspace(req);
  const showArchived = req.query.archived !== "false";
  let products = db.products.filter((p) => p.workspaceId === ws.id);
  if (!showArchived) products = products.filter((p) => !p.isArchived);
  return res.json(products);
});

// GET /products/:id — single product or 404
router.get("/products/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const product = db.products.find(
    (p) => p.id === req.params.id && p.workspaceId === ws.id,
  );
  if (!product) return notFound(res, "Product");
  return res.json(product);
});

// POST /products — create product
router.post("/products", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, description } = req.body as { name?: string; description?: string };

  if (!name || !name.trim()) {
    return badRequest(res, "name is required.");
  }

  const newProduct: Product = {
    id: genId("prod_"),
    workspaceId: ws.id,
    name: name.trim(),
    description: description ?? "",
    createdAt: new Date().toISOString(),
  };

  db.products.push(newProduct);
  saveDatabase();
  writeAuditLog(ws.id, "Admin", "CREATE", "PRODUCT", newProduct.id, null, newProduct);
  return res.status(201).json(newProduct);
});

// PUT /products/:id — update name / description
router.put("/products/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const product = db.products.find(
    (p) => p.id === req.params.id && p.workspaceId === ws.id,
  );
  if (!product) return notFound(res, "Product");

  const { name, description } = req.body as { name?: string; description?: string };
  const before = { ...product };

  if (name !== undefined) product.name = name.trim();
  if (description !== undefined) product.description = description;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "UPDATE", "PRODUCT", product.id, before, product);
  return res.json(product);
});

// DELETE /products/:id — soft-archive
router.delete("/products/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const product = db.products.find(
    (p) => p.id === req.params.id && p.workspaceId === ws.id,
  );
  if (!product) return notFound(res, "Product");

  const before = { ...product };
  product.isArchived = true;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "DELETE", "PRODUCT", product.id, before, product);
  return res.json({ archived: true, id: product.id });
});

// ── Features ───────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9_-]+$/;

const VALID_FEATURE_TYPES: Feature["type"][] = ["boolean", "limit"];

// GET /features — workspace-scoped; exclude archived when ?archived=false
router.get("/features", (req, res) => {
  const ws = resolveWorkspace(req);
  const showArchived = req.query.archived !== "false";
  let features = db.features.filter((f) => f.workspaceId === ws.id);
  if (!showArchived) features = features.filter((f) => !f.isArchived);
  return res.json(features);
});

// GET /features/:id — match by id OR slug
router.get("/features/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const { id } = req.params;
  const feature = db.features.find(
    (f) => f.workspaceId === ws.id && (f.id === id || f.slug === id),
  );
  if (!feature) return notFound(res, "Feature");
  return res.json(feature);
});

// POST /features — create feature with slug validation
router.post("/features", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, description, type, slug } = req.body as {
    name?: string;
    description?: string;
    type?: string;
    slug?: string;
  };

  if (!name || !name.trim()) {
    return badRequest(res, "name is required.");
  }
  if (!slug || !slug.trim()) {
    return badRequest(res, "slug is required.");
  }
  if (!SLUG_RE.test(slug.trim())) {
    return badRequest(
      res,
      "slug must be URL-safe: lowercase letters, digits, underscores, and hyphens only.",
    );
  }
  if (!type || !VALID_FEATURE_TYPES.includes(type as Feature["type"])) {
    return badRequest(res, `type must be one of: ${VALID_FEATURE_TYPES.join(", ")}`);
  }

  const slugNorm = slug.trim();
  const duplicate = db.features.find(
    (f) => f.workspaceId === ws.id && f.slug === slugNorm && !f.isArchived,
  );
  if (duplicate) {
    return conflict(res, `A feature with slug '${slugNorm}' already exists in this workspace.`);
  }

  const newFeature: Feature = {
    id: genId("feat_"),
    workspaceId: ws.id,
    slug: slugNorm,
    name: name.trim(),
    description: description ?? "",
    type: type as Feature["type"],
    createdAt: new Date().toISOString(),
  };

  db.features.push(newFeature);
  saveDatabase();
  writeAuditLog(ws.id, "Admin", "CREATE", "FEATURE", newFeature.id, null, newFeature);
  return res.status(201).json(newFeature);
});

// PUT /features/:id — update name / description / type
router.put("/features/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const feature = db.features.find(
    (f) => f.id === req.params.id && f.workspaceId === ws.id,
  );
  if (!feature) return notFound(res, "Feature");

  const { name, description, type } = req.body as {
    name?: string;
    description?: string;
    type?: string;
  };

  if (type !== undefined && !VALID_FEATURE_TYPES.includes(type as Feature["type"])) {
    return badRequest(res, `type must be one of: ${VALID_FEATURE_TYPES.join(", ")}`);
  }

  const before = { ...feature };

  if (name !== undefined) feature.name = name.trim();
  if (description !== undefined) feature.description = description;
  if (type !== undefined) feature.type = type as Feature["type"];

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "UPDATE", "FEATURE", feature.id, before, feature);
  return res.json(feature);
});

// DELETE /features/:id — soft-archive
router.delete("/features/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const feature = db.features.find(
    (f) => f.id === req.params.id && f.workspaceId === ws.id,
  );
  if (!feature) return notFound(res, "Feature");

  const before = { ...feature };
  feature.isArchived = true;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "DELETE", "FEATURE", feature.id, before, feature);
  return res.json({ archived: true, id: feature.id });
});

export default router;
