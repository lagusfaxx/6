const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash("cliente123");

  // ── Clean up existing demo data ──
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@demo.com" } },
    select: { id: true }
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length) {
    await prisma.favorite.deleteMany({
      where: { OR: [{ userId: { in: demoUserIds } }, { professionalId: { in: demoUserIds } }] }
    });
    await prisma.serviceRequest.deleteMany({
      where: { OR: [{ clientId: { in: demoUserIds } }, { professionalId: { in: demoUserIds } }] }
    });
    await prisma.profileMedia.deleteMany({ where: { ownerId: { in: demoUserIds } } });
    await prisma.serviceItem.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.story.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.message.deleteMany({ where: { OR: [{ senderId: { in: demoUserIds } }, { receiverId: { in: demoUserIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }

  await prisma.establishmentReview.deleteMany({ where: { establishment: { name: { startsWith: "Establecimiento" } } } });
  await prisma.establishment.deleteMany({ where: { name: { startsWith: "Establecimiento" } } });
  await prisma.category.deleteMany({
    where: {
      name: {
        in: [
          "Masajes", "Acompañamiento", "Bienestar", "Spas", "Hoteles",
          "Centros privados", "Moteles", "Night Club", "Club", "Saunas",
          "Juguetes", "Lubricantes", "Promociones", "Lencería"
        ]
      }
    }
  });

  // ── Categories ──
  const categorySeeds = [
    { name: "Acompañantes", slug: "escort", displayName: "Escorts", kind: "PROFESSIONAL" },
    { name: "Masajes sensuales", slug: "masajes", displayName: "Masajistas", kind: "PROFESSIONAL" },
    { name: "Experiencias íntimas", slug: "experiencias-intimas", displayName: "Experiencias íntimas", kind: "PROFESSIONAL" },
    { name: "Servicios VIP", slug: "servicios-vip", displayName: "Servicios VIP", kind: "PROFESSIONAL" },
    { name: "Moteles", slug: "moteles", displayName: "Moteles", kind: "ESTABLISHMENT" },
    { name: "Hoteles por hora", slug: "hoteles-por-hora", displayName: "Hoteles por hora", kind: "ESTABLISHMENT" },
    { name: "Espacios exclusivos", slug: "espacios-exclusivos", displayName: "Espacios exclusivos", kind: "ESTABLISHMENT" },
    { name: "Sex shop", slug: "sex-shop", displayName: "Sex shop", kind: "SHOP" },
    { name: "Lencería", slug: "lenceria", displayName: "Lencería", kind: "SHOP" },
    { name: "Juguetes íntimos", slug: "juguetes-intimos", displayName: "Juguetes íntimos", kind: "SHOP" },
    { name: "Productos premium", slug: "productos-premium", displayName: "Productos premium", kind: "SHOP" }
  ];

  await prisma.category.createMany({ data: categorySeeds, skipDuplicates: true });

  const professionalCategories = await prisma.category.findMany({ where: { kind: "PROFESSIONAL" } });
  const establishmentCategories = await prisma.category.findMany({ where: { kind: "ESTABLISHMENT" } });

  // ── Client users ──
  const clientUser = await prisma.user.create({
    data: {
      email: "cliente@demo.com",
      username: "cliente_demo",
      passwordHash,
      displayName: "Carlos M.",
      profileType: "VIEWER",
      gender: "MALE",
      city: "Santiago",
      address: "Providencia 123",
      termsAcceptedAt: new Date()
    }
  });

  // ── Professional profiles (10 diverse profiles) ──
  const proData = [
    {
      email: "valentina@demo.com", username: "valentina_rm", displayName: "Valentina",
      gender: "FEMALE", city: "Santiago", tier: "PREMIUM", age: 24,
      bio: "Soy Valentina, atención premium con total discreción. Me encanta consentir y hacer que cada momento sea especial.",
      profileTags: "rubia,delgada,cariñosa,natural", serviceTags: "masaje erotico,sexo oral,trios",
      lat: -33.4372, lng: -70.6506, baseRate: 80000, minDuration: 60,
      heightCm: 168, weightKg: 55, hairColor: "Rubio", skinTone: "Clara",
    },
    {
      email: "camila@demo.com", username: "camila_stgo", displayName: "Camila",
      gender: "FEMALE", city: "Santiago", tier: "PREMIUM", age: 27,
      bio: "Experiencia real, sin apuros. Disponible para incalls y outcalls en la RM.",
      profileTags: "morena,fitness,dominante,tatuada", serviceTags: "anal,bdsm,fetiches,videollamada",
      lat: -33.4489, lng: -70.6693, baseRate: 100000, minDuration: 60,
      heightCm: 172, weightKg: 60, hairColor: "Castaño", skinTone: "Trigueña",
    },
    {
      email: "isadora@demo.com", username: "isadora_vip", displayName: "Isadora",
      gender: "FEMALE", city: "Providencia", tier: "GOLD", age: 30,
      bio: "Atención exclusiva tipo novia. Conversemos para conocernos primero.",
      profileTags: "pelirroja,tetona,caliente,piercing", serviceTags: "masaje erotico,trios,packs,despedidas",
      lat: -33.4328, lng: -70.6157, baseRate: 70000, minDuration: 60,
      heightCm: 165, weightKg: 58, hairColor: "Pelirrojo", skinTone: "Clara",
    },
    {
      email: "sofia@demo.com", username: "sofia_masajes", displayName: "Sofía",
      gender: "FEMALE", city: "Las Condes", tier: "GOLD", age: 25,
      bio: "Masajista profesional certificada. Relax total garantizado.",
      profileTags: "delgada,natural,cariñosa,sumisa", serviceTags: "masaje erotico,sexo oral",
      lat: -33.4103, lng: -70.5718, baseRate: 60000, minDuration: 60,
      heightCm: 160, weightKg: 52, hairColor: "Negro", skinTone: "Clara",
    },
    {
      email: "antonella@demo.com", username: "antonella_hot", displayName: "Antonella",
      gender: "FEMALE", city: "Viña del Mar", tier: "GOLD", age: 22,
      bio: "Soy Antonella de Viña. Muy coqueta y atrevida. Atiendo en depa propio.",
      profileTags: "culona,morena,caliente,natural", serviceTags: "anal,sexo oral,videollamada,lluvia dorada",
      lat: -33.0153, lng: -71.5505, baseRate: 50000, minDuration: 30,
      heightCm: 163, weightKg: 62, hairColor: "Castaño", skinTone: "Trigueña",
    },
    {
      email: "renata@demo.com", username: "renata_fit", displayName: "Renata",
      gender: "FEMALE", city: "Ñuñoa", tier: "SILVER", age: 28,
      bio: "Fit, deportista, y muy apasionada. Primera vez me contactas? Te garantizo que vuelves.",
      profileTags: "fitness,delgada,tatuada,dominante", serviceTags: "bdsm,fetiches,rol,trios",
      lat: -33.4569, lng: -70.5976, baseRate: 55000, minDuration: 60,
      heightCm: 170, weightKg: 57, hairColor: "Rubio", skinTone: "Clara",
    },
    {
      email: "luna@demo.com", username: "luna_trans", displayName: "Luna",
      gender: "OTHER", city: "Santiago Centro", tier: "SILVER", age: 26,
      bio: "Hola soy Luna, chica trans muy femenina y complaciente. Atiendo con cariño y sin apuro.",
      profileTags: "delgada,cariñosa,natural,piercing", serviceTags: "masaje erotico,sexo oral,videollamada",
      lat: -33.4513, lng: -70.6653, baseRate: 45000, minDuration: 30,
      heightCm: 175, weightKg: 63, hairColor: "Negro", skinTone: "Clara",
    },
    {
      email: "martina@demo.com", username: "martina_madura", displayName: "Martina",
      gender: "FEMALE", city: "Concepción", tier: "SILVER", age: 42,
      bio: "Mujer madura con experiencia. Atención cariñosa y sin prisas. Depa propio y discreto.",
      profileTags: "gordita,tetona,cariñosa,sumisa", serviceTags: "masaje erotico,sexo oral,packs",
      lat: -36.8270, lng: -73.0498, baseRate: 40000, minDuration: 30,
      heightCm: 158, weightKg: 72, hairColor: "Castaño", skinTone: "Clara",
    },
    {
      email: "karen@demo.com", username: "karen_norte", displayName: "Karen",
      gender: "FEMALE", city: "Antofagasta", tier: "SILVER", age: 29,
      bio: "Disponible en Antofagasta. Viajo a regiones por encargo.",
      profileTags: "morena,culona,caliente,trigueña", serviceTags: "anal,trios,despedidas,discapacitados",
      lat: -23.6509, lng: -70.3975, baseRate: 50000, minDuration: 60,
      heightCm: 162, weightKg: 65, hairColor: "Negro", skinTone: "Morena",
    },
    {
      email: "daniela@demo.com", username: "daniela_sur", displayName: "Daniela",
      gender: "FEMALE", city: "Temuco", tier: "SILVER", age: 23,
      bio: "Chica joven y atrevida del sur. Disponible para videollamadas y presencial.",
      profileTags: "rubia,delgada,natural,cariñosa", serviceTags: "videollamada,masaje erotico,sexo oral,packs",
      lat: -38.7359, lng: -72.5904, baseRate: 35000, minDuration: 30,
      heightCm: 166, weightKg: 54, hairColor: "Rubio", skinTone: "Clara",
    }
  ];

  const professionals = [];
  for (let i = 0; i < proData.length; i++) {
    const p = proData[i];
    const cat = professionalCategories[i % professionalCategories.length];

    // Calculate birthdate from age
    const bd = new Date();
    bd.setFullYear(bd.getFullYear() - (p.age || 25));

    const pro = await prisma.user.create({
      data: {
        email: p.email,
        username: p.username,
        passwordHash,
        displayName: p.displayName,
        profileType: "PROFESSIONAL",
        gender: p.gender,
        city: p.city,
        address: `Dirección privada, ${p.city}`,
        latitude: p.lat,
        longitude: p.lng,
        categoryId: cat.id,
        isActive: true,
        tier: p.tier,
        isOnline: i < 5,  // first 5 are online
        lastSeen: new Date(Date.now() - i * 600000), // staggered
        bio: p.bio,
        serviceDescription: p.bio,
        profileTags: (p.profileTags || "").split(",").filter(Boolean),
        serviceTags: (p.serviceTags || "").split(",").filter(Boolean),
        baseRate: p.baseRate,
        minDurationMinutes: p.minDuration,
        heightCm: p.heightCm,
        weightKg: p.weightKg,
        hairColor: p.hairColor,
        skinTone: p.skinTone,
        birthdate: bd,
        completedServices: Math.floor(Math.random() * 50) + 5,
        profileViews: Math.floor(Math.random() * 500) + 100,
        membershipExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        termsAcceptedAt: new Date(),
      }
    });
    professionals.push(pro);

    // Add gallery images (placeholder)
    await prisma.profileMedia.create({
      data: { ownerId: pro.id, type: "IMAGE", url: "/brand/isotipo-new.png" }
    });

    // Add service items
    const tags = (p.serviceTags || "").split(",").filter(Boolean);
    for (const tag of tags.slice(0, 3)) {
      await prisma.serviceItem.create({
        data: {
          ownerId: pro.id,
          title: tag.charAt(0).toUpperCase() + tag.slice(1),
          description: `Servicio de ${tag} con atención personalizada`,
          price: p.baseRate + Math.floor(Math.random() * 20000),
          durationMinutes: p.minDuration,
        }
      }).catch(() => {}); // skip if table not ready
    }
  }

  // ── Establishments ──
  for (let i = 0; i < 5; i++) {
    const cat = establishmentCategories[i % establishmentCategories.length];
    await prisma.establishment.create({
      data: {
        categoryId: cat.id,
        name: `Establecimiento ${i + 1}`,
        city: "Santiago",
        address: `Av. Principal ${200 + i}`,
        phone: `+56 9 1234 56${i}`,
        description: "Espacio seguro y cómodo para clientes.",
        latitude: -33.48 + i * 0.01,
        longitude: -70.62 + i * 0.01,
        galleryUrls: ["/brand/isotipo-new.png"]
      }
    });
  }

  // ── Interactions (favorites, requests, reviews) ──
  if (professionals.length >= 4) {
    await prisma.favorite.create({
      data: { userId: clientUser.id, professionalId: professionals[0].id }
    });
    await prisma.favorite.create({
      data: { userId: clientUser.id, professionalId: professionals[2].id }
    });

    const sr1 = await prisma.serviceRequest.create({
      data: {
        clientId: clientUser.id,
        professionalId: professionals[1].id,
        status: "FINALIZADO",
        requestedDate: "2026-02-20",
        requestedTime: "20:00",
        agreedLocation: "Hotel Centro",
        clientComment: "Primera vez, excelente atención",
      }
    });
    await prisma.professionalReview.create({
      data: {
        serviceRequestId: sr1.id,
        hearts: 5,
        comment: "Excelente servicio, muy profesional y puntual."
      }
    });

    const sr2 = await prisma.serviceRequest.create({
      data: {
        clientId: clientUser.id,
        professionalId: professionals[3].id,
        status: "FINALIZADO",
        requestedDate: "2026-02-18",
        requestedTime: "15:00",
        agreedLocation: "Motel Las Rosas",
        clientComment: "Muy buen masaje",
      }
    });
    await prisma.professionalReview.create({
      data: {
        serviceRequestId: sr2.id,
        hearts: 4,
        comment: "Buena atención, recomendable."
      }
    });
  }

  console.log("✅ Seed complete: 10 professionals, 1 client, 5 establishments, reviews and favorites");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
