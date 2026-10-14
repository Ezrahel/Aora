import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  productRepo,
  featureRepo,
} from "../db.ts";
import { asyncHandler, badRequest, notFound, conflict } from "../middleware.ts";
import type { Feature } from "../types.ts";

export const router = Router();

// ── Products ───────────────────────────────────────────────

router.get("/products", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const showArchived = req.query.archived !== "false";
  const products = await productRepo.findByWorkspace(ws.id, showArchived);
  res.json(products);
}));

router.get("/products/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const product = await productRepo.findById(null as any, req.params.id);
  if (!product || product.workspaceId !== ws.id) return notFound(res, "Product");
  res.json(product);
}));

router.post("/products", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name || !name.trim()) return badRequest(res, "name is required.");

  const newProduct = await productRepo.create(null as any, {
    id: genId("prod_"),
    workspaceId: ws.id,
    name: name.trim(),
    description,
  });
  await writeAuditLog(ws.id, "Admin", "CREATE", "PRODUCT", newProduct.id, null, newProduct);
  res.status(201).json(newProduct);
}));

router.put("/products/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const product = await productRepo.findById(null as any, req.params.id);
  if (!product || product.workspaceId !== ws.id) return notFound(res, "Product");

  const { name, description } = req.body as { name?: string; description?: string };
  const before = { ...product };
  const updated = await productRepo.update(null as any, product.id, { name, description });
  if (!updated) return notFound(res, "Product");
  await writeAuditLog(ws.id, "Admin", "UPDATE", "PRODUCT", product.id, before, updated);
  res.json(updated);
}));

router.delete("/products/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const product = await productRepo.findById(null as any, req.params.id);
  if (!product || product.workspaceId !== ws.id) return notFound(res, "Product");

  const before = { ...product };
  await productRepo.softDelete(null as any, product.id);
  await writeAuditLog(ws.id, "Admin", "DELETE", "PRODUCT", product.id, before, { ...product, isArchived: true });
  res.json({ archived: true, id: product.id });
}));

// ── Features ───────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9_-]+$/;
const VALID_FEATURE_TYPES: Feature["type"][] = ["boolean", "limit"];

router.get("/features", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const showArchived = req.query.archived !== "false";
  const features = await featureRepo.findByWorkspace(ws.id, showArchived);
  res.json(features);
}));

router.get("/features/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const feature = await featureRepo.findBySlugOrId(ws.id, req.params.id);
  if (!feature) return notFound(res, "Feature");
  res.json(feature);
}));

router.post("/features", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { name, description, type, slug } = req.body as {
    name?: string; description?: string; type?: string; slug?: string;
  };

  if (!name || !name.trim()) return badRequest(res, "name is required.");
  if (!slug || !slug.trim()) return badRequest(res, "slug is required.");
  if (!SLUG_RE.test(slug.trim())) return badRequest(res, "slug must be URL-safe.");
  if (!type || !VALID_FEATURE_TYPES.includes(type as Feature["type"])) {
    return badRequest(res, `type must be one of: ${VALID_FEATURE_TYPES.join(", ")}`);
  }

  const slugNorm = slug.trim();
  const duplicate = await featureRepo.findBySlug(ws.id, slugNorm);
  if (duplicate && !duplicate.isArchived) {
    return conflict(res, `A feature with slug '${slugNorm}' already exists.`);
  }

  const newFeature = await featureRepo.create(null as any, {
    id: genId("feat_"),
    workspaceId: ws.id,
    slug: slugNorm,
    name: name.trim(),
    description,
    type: type as Feature["type"],
  });
  await writeAuditLog(ws.id, "Admin", "CREATE", "FEATURE", newFeature.id, null, newFeature);
  res.status(201).json(newFeature);
}));

router.put("/features/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const feature = await featureRepo.findById(null as any, req.params.id);
  if (!feature || feature.workspaceId !== ws.id) return notFound(res, "Feature");

  const { name, description, type } = req.body as {
    name?: string; description?: string; type?: string;
  };
  if (type !== undefined && !VALID_FEATURE_TYPES.includes(type as Feature["type"])) {
    return badRequest(res, `type must be one of: ${VALID_FEATURE_TYPES.join(", ")}`);
  }

  const before = { ...feature };
  const updated = await featureRepo.update(null as any, feature.id, {
    name, description, type: type as Feature["type"] | undefined,
  });
  if (!updated) return notFound(res, "Feature");
  await writeAuditLog(ws.id, "Admin", "UPDATE", "FEATURE", feature.id, before, updated);
  res.json(updated);
}));

router.delete("/features/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const feature = await featureRepo.findById(null as any, req.params.id);
  if (!feature || feature.workspaceId !== ws.id) return notFound(res, "Feature");

  const before = { ...feature };
  await featureRepo.softDelete(null as any, feature.id);
  await writeAuditLog(ws.id, "Admin", "DELETE", "FEATURE", feature.id, before, { ...feature, isArchived: true });
  res.json({ archived: true, id: feature.id });
}));

export default router;
