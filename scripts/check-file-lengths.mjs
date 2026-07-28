import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_LINES = 500;
const CHECKED_EXTENSIONS = /\.(cjs|css|js|mjs|sh|ts|tsx)$/;
const EXCLUDED_PATHS = /(^|\/)(node_modules|\.next|coverage|out|build)\//;

const output = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  {
    encoding: "utf8",
  },
);

const oversizedFiles = output
  .split("\n")
  .filter((file) => file && CHECKED_EXTENSIONS.test(file))
  .filter((file) => !EXCLUDED_PATHS.test(file))
  .map((file) => ({
    file,
    lines: readFileSync(file, "utf8").split(/\r?\n/).length,
  }))
  .filter(({ lines }) => lines > MAX_LINES);

if (oversizedFiles.length > 0) {
  process.stderr.write(`Guardian: files exceed ${MAX_LINES} lines:\n`);
  for (const { file, lines } of oversizedFiles) {
    process.stderr.write(`  ${file}: ${lines} lines\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Guardian: all checked files are within ${MAX_LINES} lines.\n`,
);
