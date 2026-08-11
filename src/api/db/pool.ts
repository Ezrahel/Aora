import pg from "pg";

export type Client = pg.PoolClient;

let pool: pg.Pool;

function getPool(): pg.Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({
      connectionString: dbUrl,
      max: parseInt(process.env.DATABASE_POOL_MAX || "5", 10),
      idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || "30000", 10),
      connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || "30000", 10),
      statement_timeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || "10000", 10),
      application_name: "aora_billing",
    });

    pool.on("error", (err) => {
      console.error("Unexpected pool error:", err);
    });
  }
  return pool;
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "40001") {
      return withTransaction(fn);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function retryable<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  maxAttempts = 15,
): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      return await withTransaction(fn);
    } catch (err: any) {
      if (err.code === "40001" && attempts < maxAttempts) {
        const backoff = Math.min(2 ** attempts * 0.1, 2);
        await new Promise((r) => setTimeout(r, backoff * 1000));
        attempts++;
        continue;
      }
      throw err;
    }
  }
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  return p.query<T>(text, params);
}

const proxy: Omit<typeof import("./pool.ts"), "default"> & { default: pg.Pool } = {
  withTransaction,
  retryable,
  query,
} as any;

export default proxy as unknown as pg.Pool;
