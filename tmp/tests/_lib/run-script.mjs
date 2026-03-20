import { spawn } from "node:child_process";
import path from "node:path";

export async function runNodeScript({
  rootDir,
  scriptRelativePath,
  env = {}
}) {
  const nodeExecutable = process.execPath;
  const scriptPath = path.join(rootDir, scriptRelativePath);

  await new Promise((resolve, reject) => {
    const child = spawn(nodeExecutable, [scriptPath], {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        ...env
      }
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Script failed (${scriptRelativePath}) with exit code ${code ?? -1}.`)
      );
    });
  });
}
