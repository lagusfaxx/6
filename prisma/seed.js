// Prisma seed runner (runtime-safe)
try {
  require('./dist/seed.js');
} catch (e) {
  try {
    require('./seed.ts');
  } catch (err) {
    console.error('Seed script not found. Ensure prisma/seed.ts or prisma/dist/seed.js exists.');
    process.exit(1);
  }
