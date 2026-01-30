import * as fs from "fs";
import * as path from "path";

function ensurePrismaClientFiles() {
  try {
    const clientPath = require.resolve("@prisma/client");
    const clientDir = path.dirname(clientPath);
    const targetDir = path.join(clientDir, ".prisma");
    const targetEntry = path.join(targetDir, "client", "default.js");

    if (fs.existsSync(targetEntry)) {
      return;
    }

    const candidates = [
      path.join(clientDir, "..", "..", ".prisma"),
      path.join(clientDir, "..", "..", "..", ".prisma"),
      path.join(process.cwd(), "node_modules", ".prisma")
    ];

    const sourceDir = candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, "client", "default.js"))
    );

    if (!sourceDir) {
      return;
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
  } catch {
    // If copying fails, Prisma will throw on import as usual.
  }
}

ensurePrismaClientFiles();

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const { PrismaClient } = require("@prisma/client");
