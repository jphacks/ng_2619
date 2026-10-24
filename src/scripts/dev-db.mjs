// Docker がない環境向けの開発用 PostgreSQL 16（embedded-postgres）。
// 使い方: npm run db:local （止めるときは Ctrl+C）
// データは .pgdata/ に保存される。接続先は .env.example の DATABASE_URL と同じ。

import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const port = Number(process.env.DEV_DB_PORT ?? 54329);
const dataDir = path.resolve(process.cwd(), ".pgdata");
const isNew = !existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (isNew) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = 'kids_outdoor'");
if (exists.rowCount === 0) await pg.createDatabase("kids_outdoor");
await client.end();

console.log(`PostgreSQL 16 is running on localhost:${port} (database: kids_outdoor). Ctrl+C to stop.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
