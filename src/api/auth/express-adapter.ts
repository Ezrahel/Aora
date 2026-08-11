import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

type WebHandler = (request: Request) => Response | Promise<Response>;

/**
 * Wraps a Web-standard request handler (like Better Auth's
 * `auth.handler`) so it can be mounted as Express middleware.
 *
 * Usage:
 *   app.use("/api/auth", webHandler(getAuth().handler));
 */
export function webHandler(handler: WebHandler) {
  return async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const webReq = toWebRequest(req);
      const webRes = await handler(webReq);
      await writeWebResponse(res, webRes);
    } catch (err) {
      console.error("[webHandler]", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}

function toWebRequest(req: ExpressRequest): Request {
  const url = `${req.protocol}://${req.headers.host ?? "localhost"}${req.originalUrl}`;
  const method = req.method ?? "GET";

  const headers = new Headers();
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }
  }

  const body =
    method === "GET" || method === "HEAD" || !req.body
      ? undefined
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

  return new Request(url, { method, headers, body });
}

async function writeWebResponse(res: ExpressResponse, webRes: Response): Promise<void> {
  res.status(webRes.status);

  for (const [key, value] of webRes.headers.entries()) {
    res.setHeader(key, value);
  }

  if (webRes.body) {
    const reader = webRes.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    res.end(buffer);
  } else {
    res.end();
  }
}
