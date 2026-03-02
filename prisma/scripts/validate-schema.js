const fs = require("node:fs");
const path = require("node:path");

const schemaPath = path.join(__dirname, "..", "schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");

const invalidMarkers = [
  /^@@\s+-/m,
  /^<<<<<<<\s+/m,
  /^=======\s*$/m,
  /^>>>>>>>\s+/m
];

const hasInvalidMarkers = invalidMarkers.some((pattern) => pattern.test(schema));

if (hasInvalidMarkers) {
  console.error(
    "Invalid markers detected in prisma/schema.prisma. Remove diff or merge markers before running Prisma." // eslint-disable-line no-console
  );
  process.exit(1);
}
