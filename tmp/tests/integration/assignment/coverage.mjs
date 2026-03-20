import path from "node:path";
import { fileURLToPath } from "node:url";

import { runNodeScript } from "../../_lib/run-script.mjs";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const rootDir = path.resolve(currentDir, "../../../../");

const scripts = [
  "tmp/verify-auto-assignment-v1.mjs",
  "tmp/tests/integration/assignment/swap-flow.mjs",
  "tmp/verify-waiting-list-step1.mjs"
];

for (const scriptRelativePath of scripts) {
  console.log(`\n[assignment] running ${scriptRelativePath}`);
  await runNodeScript({
    rootDir,
    scriptRelativePath
  });
}

console.log("\nAssignment integration coverage passed.");
