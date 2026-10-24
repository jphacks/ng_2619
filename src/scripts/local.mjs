// Cross-platform entry point, invoked from the repository root with npm start.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fork, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Node.js 22 以上をインストールして、もう一度実行してください。");
  process.exit(1);
}
if (!existsSync("node_modules/embedded-postgres")) {
  console.error("先にリポジトリのルートで npm run setup を実行してください。");
  process.exit(1);
}
if (!existsSync(".env")) {
  const template = readFileSync(".env.example", "utf8").replaceAll("change-me", () => randomBytes(32).toString("hex"));
  writeFileSync(".env", template, { flag: "wx", mode: 0o600 });
  console.log(".env を作成しました（既存の設定は上書きしません）。");
}
process.loadEnvFile(".env");
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "54329" || url.pathname !== "/kids_outdoor" || url.username !== "postgres" || url.password !== "postgres") {
  console.error("簡単起動には .env.example と同じローカルDB接続設定が必要です。別のDBを使う場合は src/README.md の手動起動を参照してください。");
  process.exit(1);
}
let db;
let app;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const children = [app, db].filter(child => child && child.exitCode === null);
  await Promise.all(children.map(child => new Promise(resolve => {
    child.once("exit", resolve);
    if (child === db && child.connected) child.send("stop");
    else child.kill("SIGTERM");
  })));
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
function run(script, args = [], extraEnv = {}) {
  return new Promise((resolve, reject) => {
    app = spawn(process.execPath, [path.join(root, script), ...args], {
      stdio: "inherit", env: { ...process.env, ...extraEnv },
    });
    app.once("error", reject);
    app.once("exit", code => code === 0 ? resolve() : reject(new Error(`コマンドが終了しました (${code})`)));
  });
}
try {
  await new Promise((resolve, reject) => {
    db = fork(path.join(root, "scripts/dev-db.mjs"), [], {
      stdio: ["inherit", "inherit", "inherit", "ipc"], env: { ...process.env, DEV_DB_PORT: "54329" },
    });
    db.once("message", message => message === "ready" && resolve());
    db.once("error", reject);
    db.once("exit", code => {
      reject(new Error(`データベースを起動できませんでした (${code})。他のDBがポート54329を使用していないか確認してください。`));
      if (!stopping && app) void stop(1);
    });
  });
  if (process.argv.includes("--setup")) {
    await run("node_modules/prisma/build/index.js", ["generate"]);
    await run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
    await run("node_modules/tsx/dist/cli.mjs", ["prisma/seed.ts"], { SEED_DEMO: "1" });
    console.log("初回設定が完了しました。npm start で起動できます。");
  } else {
    console.log("http://localhost:3000 をブラウザで開いてください。終了: Ctrl+C");
    await run("node_modules/next/dist/bin/next", ["dev", "--hostname", "127.0.0.1", "--port", "3000"]);
  }
  await stop();
} catch (error) {
  console.error(error.message);
  await stop(1);
}
