import type { Pool } from "pg";

/** The common SQL surface for PostgreSQL and embedded PostgreSQL. */
export interface Sql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  transaction?<T>(work: (sql: Sql) => Promise<T>): Promise<T>;
}

export type QueryRunner = <T>(text: string, params: unknown[]) => Promise<T[]>;
export type TransactionRunner = <T>(work: (run: QueryRunner) => Promise<T>) => Promise<T>;

/** A transaction receives a client bound to its own connection, never the pool. */
export function createSqlClient(run: QueryRunner, transaction?: TransactionRunner): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  if (transaction) {
    sql.transaction = <T>(work: (tx: Sql) => Promise<T>) =>
      transaction((txRun) => work(createSqlClient(txRun)));
  }
  return sql;
}

export function createPostgresSql(pool: Pick<Pool, "query" | "connect">): Sql {
  return createSqlClient(
    async <T>(text: string, params: unknown[]) => (await pool.query(text, params)).rows as T[],
    async (work) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const run: QueryRunner = async <T>(text: string, params: unknown[]) =>
          (await client.query(text, params)).rows as T[];
        const result = await work(run);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  );
}
