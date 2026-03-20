import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

import { runNodeScript } from "./_lib/run-script.mjs";

const currentFile = fileURLToPath(import.meta.url);
const testsDir = path.dirname(currentFile);
const rootDir = path.resolve(testsDir, "../..");
const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const port = Number(new URL(baseUrl).port || 4010);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isServerUp() {
  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: "GET"
    });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerUp()) {
      return true;
    }

    await sleep(500);
  }

  return false;
}

function startServer() {
  const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
  const hasBuild = fs.existsSync(path.join(rootDir, ".next", "BUILD_ID"));
  const mode = hasBuild ? "start" : "dev";
  const child = spawn(process.execPath, [nextCliPath, mode, "-p", String(port)], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env
    }
  });

  console.log(`Started Next.js server in ${mode} mode for integration suites.`);

  return child;
}

const suites = [
  "tmp/tests/integration/assignment/coverage.mjs",
  "tmp/tests/integration/notifications/coverage.mjs",
  "tmp/tests/integration/reporting/coverage.mjs"
];

let serverProcess = null;
let startedBySuite = false;

try {
  if (!(await isServerUp())) {
    console.log(`No app server detected at ${baseUrl}. Starting local server...`);
    serverProcess = startServer();
    startedBySuite = true;

    const ready = await waitForServer();

    if (!ready) {
      throw new Error("Timed out waiting for app server before running integration coverage.");
    }
  } else {
    console.log(`Using existing app server at ${baseUrl}.`);
  }

  for (const suiteRelativePath of suites) {
    console.log(`\n=== Running suite: ${suiteRelativePath} ===`);
    await runNodeScript({
      rootDir,
      scriptRelativePath: suiteRelativePath,
      env: {
        EXAMOPS_BASE_URL: baseUrl
      }
    });
  }

  console.log("\nAll production-readiness integration suites passed.");
} finally {
  if (startedBySuite && serverProcess) {
    serverProcess.kill("SIGTERM");
    await sleep(500);
  }
}
