import path from "node:path";
import { fileURLToPath } from "node:url";

import { runNodeScript } from "../../_lib/run-script.mjs";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const rootDir = path.resolve(currentDir, "../../../../");

const scripts = ["tmp/verify-phase8-step2.mjs", "tmp/verify-phase8-step3.mjs"];

for (const scriptRelativePath of scripts) {
  console.log(`\n[reporting] running ${scriptRelativePath}`);
  await runNodeScript({
    rootDir,
    scriptRelativePath
  });
}

console.log("\nReporting integration coverage passed.");
