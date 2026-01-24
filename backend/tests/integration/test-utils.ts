import { serve } from "@hono/node-server";

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const { createApp } = await import("../../src/app.js");

  const app = createApp();
  const port = 3100 + Math.floor(Math.random() * 2000);
  const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export async function resetDatabase(): Promise<void> {
  const { db } = await import("../../src/db/client.js");
  const schema = await import("../../src/db/schema.js");

  await db.delete(schema.syncLogs);
  await db.delete(schema.tiktokVideoDaily);
  await db.delete(schema.tiktokUserDaily);
  await db.delete(schema.storeAccounts);
  await db.delete(schema.oauthState);
  await db.delete(schema.stores);
  await db.delete(schema.syncLocks);
}
