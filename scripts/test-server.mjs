import { randomBytes, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port: 0, maxConnections: 5 });
await server.start();
const salt = randomBytes(16).toString("hex");
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`,
  TEAM_PASSWORD_HASH: `scrypt:${salt}:${scryptSync("browser-test-password", salt, 64).toString("hex")}`,
  SESSION_SECRET: randomBytes(32).toString("hex"),
  NEXT_TELEMETRY_DISABLED: "1",
  APP_ORIGIN: "http://127.0.0.1:3100",
};
async function run(command, args) {
  const child = spawn(command, args, { env, stdio: "inherit" });
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} beendet: ${code}`)));
  });
}
let app;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (app && app.exitCode === null) {
    const exited = new Promise((resolve) => app.once("exit", resolve));
    app.kill("SIGTERM");
    await exited;
  }
  await server.stop();
  await database.close();
}
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
try {
  await run(process.execPath, ["scripts/migrate.mjs"]);
  await run(process.execPath, ["scripts/migrate.mjs"]);
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], { env, stdio: "inherit" });
  app.on("error", (error) => { console.error(error); process.exitCode = 1; void close(); });
  app.on("exit", (code) => { if (!closing) { process.exitCode = code || 1; void close(); } });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  await close();
}
