const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash("cliente123");

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@demo.com" } },
    select: { id: true }
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length) {
    await prisma.favorite.deleteMany({
      where: {
        OR: [{ userId: { in: demoUserIds } }, { professionalId: { in: demoUserIds } }]
      }
    });
    await prisma.serviceRequest.deleteMany({
      where: {
        OR: [{ clientId: { in: demoUserIds } }, { professionalId: { in: demoUserIds } }]
      }
    });
    await prisma.profileMedia.deleteMany({ where: { ownerId: { in: demoUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }

  await prisma.establishmentReview.deleteMany({ where: { establishment: { name: { startsWith: "Establecimiento" } } } });
  await prisma.establishment.deleteMany({ where: { name: { startsWith: "Establecimiento" } } });
  await prisma.category.deleteMany({
    where: { name: { in: ["Masajes", "Acompañamiento", "Bienestar", "Spas", "Hoteles", "Centros privados"] } }
  });

  await prisma.category.createMany({
    data: [
      { name: "Masajes", kind: "PROFESSIONAL" },
      { name: "Acompañamiento", kind: "PROFESSIONAL" },
      { name: "Bienestar", kind: "PROFESSIONAL" },
      { name: "Spas", kind: "ESTABLISHMENT" },
      { name: "Hoteles", kind: "ESTABLISHMENT" },
      { name: "Centros privados", kind: "ESTABLISHMENT" }
    ]
  });

  const professionalCategories = await prisma.category.findMany({ where: { kind: "PROFESSIONAL" } });
  const establishmentCategories = await prisma.category.findMany({ where: { kind: "ESTABLISHMENT" } });

  const clientUser = await prisma.user.create({
    data: {
      email: "cliente@demo.com",
      username: "cliente",
      passwordHash,
      displayName: "Cliente Demo",
      profileType: "VIEWER",
      gender: "OTHER",
      city: "Santiago",
      address: "Providencia 123",
      termsAcceptedAt: new Date()
    }
  });

  const tiers = ["PREMIUM", "GOLD", "SILVER"];
  const genders = ["FEMALE", "MALE", "OTHER"];

  const professionals = [];
  for (let i = 0; i < 10; i += 1) {
    const category = professionalCategories[i % professionalCategories.length];
    const professional = await prisma.user.create({
      data: {
        email: `pro${i}@demo.com`,
        username: `pro${i}`,
        passwordHash,
        displayName: `Profesional ${i + 1}`,
        profileType: "PROFESSIONAL",
        gender: genders[i % genders.length],
        city: "Santiago",
        address: `Calle ${i + 10} #${100 + i}`,
        latitude: -33.45 + i * 0.01,
        longitude: -70.66 + i * 0.01,
        categoryId: category.id,
        isActive: i % 3 !== 0,
        tier: tiers[i % tiers.length],
        isOnline: i % 2 === 0,
        lastSeen: new Date(Date.now() - i * 3600 * 1000),
        serviceDescription: "Atención personalizada y discreta.",
        termsAcceptedAt: new Date()
      }
    });
    professionals.push(professional);
    await prisma.profileMedia.create({
      data: {
        ownerId: professional.id,
        type: "IMAGE",
        url: "/brand/isotipo.png"
      }
    });
  }

  for (let i = 0; i < 5; i += 1) {
    const category = establishmentCategories[i % establishmentCategories.length];
    await prisma.establishment.create({
      data: {
        categoryId: category.id,
        name: `Establecimiento ${i + 1}`,
        city: "Santiago",
        address: `Av. Principal ${200 + i}`,
        phone: `+56 9 1234 56${i}`,
        description: "Espacio seguro y cómodo para clientes.",
        latitude: -33.48 + i * 0.01,
        longitude: -70.62 + i * 0.01,
        galleryUrls: ["/brand/isotipo.png", "/brand/isotipo.png"]
      }
    });
  }

  await prisma.favorite.create({
    data: {
      userId: clientUser.id,
      professionalId: professionals[0].id
    }
  });

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      clientId: clientUser.id,
      professionalId: professionals[1].id,
      status: "PENDIENTE_EVALUACION"
    }
  });

  await prisma.professionalReview.create({
    data: {
      serviceRequestId: serviceRequest.id,
      hearts: 5,
      comment: "Excelente servicio."
    }
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
