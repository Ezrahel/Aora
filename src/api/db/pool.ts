import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://root@localhost:26257/aora_billing?sslmode=disable",
  max: parseInt(process.env.DATABASE_POOL_MAX || "50", 10),
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || "30000", 10),
  connectionTimeoutMillis: 5_000,
  statement_timeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || "10000", 10),
  application_name: "aora_billing",
});

pool.on("error", (err) => {
  console.error("Unexpected pool error:", err);
});

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
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
  return pool.query<T>(text, params);
}

export default pool;
