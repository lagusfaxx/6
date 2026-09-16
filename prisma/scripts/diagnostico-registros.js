/**
 * Diagnóstico de la caída de registros diarios.
 *
 * Separa las dos explicaciones que se confunden en el mismo número:
 *
 *  a) Se registran menos profesionales  → cae `altas` (filas nuevas en User).
 *  b) Se registran igual pero no salen   → `altas` se mantiene y lo que cae es
 *     `publicadas` (isActive) o `verificadas` (isVerified), porque desde el
 *     3-9-2026 el inicio exige ambas y un perfil nuevo nace apagado y sin
 *     verificar: sólo lo publica una aprobación en el panel.
 *
 * Imprime, por día: altas, cuántas de esas altas están hoy verificadas y
 * publicadas, cuántas nunca crearon contraseña (se fueron a mitad del flujo),
 * y cuántas verificaciones se aprobaron ese día. Al final, los perfiles que
 * quedaron atrapados (verificados pero apagados) y los Gold pendientes de pago.
 *
 * Usage:
 *   DATABASE_URL=... node prisma/scripts/diagnostico-registros.js [díasAtrás]
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DAYS = Number(process.argv[2] || 45);

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function emptyRow() {
  return {
    altas: 0,
    conPassword: 0,
    verificadas: 0,
    publicadas: 0,
    aprobadas: 0,
  };
}

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const altas = await prisma.user.findMany({
    where: {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
      createdAt: { gte: since },
    },
    select: {
      createdAt: true,
      verifiedAt: true,
      isVerified: true,
      isActive: true,
      passwordHash: true,
    },
  });

  const porDia = new Map();
  const row = (key) => {
    if (!porDia.has(key)) porDia.set(key, emptyRow());
    return porDia.get(key);
  };

  for (const u of altas) {
    const r = row(dayKey(u.createdAt));
    r.altas++;
    if (u.passwordHash) r.conPassword++;
    if (u.isVerified) r.verificadas++;
    if (u.isActive) r.publicadas++;
    if (u.verifiedAt && u.verifiedAt >= since) row(dayKey(u.verifiedAt)).aprobadas++;
  }

  const dias = [...porDia.keys()].sort();
  console.log(
    "\nfecha       altas  c/clave  verificadas  publicadas  aprobadas-ese-día",
  );
  console.log("─".repeat(70));
  for (const d of dias) {
    const r = porDia.get(d);
    console.log(
      `${d}  ${String(r.altas).padStart(5)}  ${String(r.conPassword).padStart(7)}  ` +
        `${String(r.verificadas).padStart(11)}  ${String(r.publicadas).padStart(10)}  ` +
        `${String(r.aprobadas).padStart(17)}`,
    );
  }

  const atrapadas = await prisma.user.count({
    where: {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
      isVerified: true,
      isActive: false,
    },
  });
  const sinVerificar = await prisma.user.count({
    where: {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
      isVerified: false,
      createdAt: { gte: since },
    },
  });
  const sinClave = await prisma.user.count({
    where: {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
      passwordHash: null,
      createdAt: { gte: since },
    },
  });
  const goldPendientes = await prisma.pendingGoldRegistration.count({
    where: { status: "PENDING", createdAt: { gte: since } },
  });

  console.log("\nEstado acumulado");
  console.log("─".repeat(70));
  console.log(`Verificadas pero apagadas (invisibles en el inicio): ${atrapadas}`);
  console.log(`Altas de los últimos ${DAYS} días sin verificar:        ${sinVerificar}`);
  console.log(`Altas de los últimos ${DAYS} días sin crear contraseña: ${sinClave}`);
  console.log(`Registros Gold pendientes de pago:                   ${goldPendientes}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
