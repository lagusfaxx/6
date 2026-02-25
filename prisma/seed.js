const { PrismaClient, ProfileType, ProfessionalTier } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

const zones = [
  { city: "Santiago", district: "Las Condes", latitude: -33.4097, longitude: -70.5678 },
  { city: "Santiago", district: "Providencia", latitude: -33.4263, longitude: -70.6186 },
  { city: "Santiago", district: "Santiago Centro", latitude: -33.4489, longitude: -70.6693 },
  { city: "Viña del Mar", district: "Plan", latitude: -33.0245, longitude: -71.5518 },
  { city: "La Serena", district: "Centro", latitude: -29.9027, longitude: -71.2519 },
  { city: "Concepción", district: "Centro", latitude: -36.8269, longitude: -73.0498 }
];

const personas = [
  {
    gender: "FEMALE",
    category: "Escorts",
    ageMin: 22,
    ageMax: 34,
    bioTemplate: "Atención de compañía premium en {district}, trato cercano y discreción total.",
    serviceTags: ["GFE", "Anal", "Video llamadas", "Salidas", "Fantasías"]
  },
  {
    gender: "FEMALE",
    category: "Maduras",
    ageMin: 40,
    ageMax: 55,
    bioTemplate: "Madura elegante con experiencia, ambiente tranquilo y atención sin apuros en {city}.",
    serviceTags: ["Masajes", "Conversación", "Relajo", "Atención pareja", "Video llamadas"]
  },
  {
    gender: "OTHER",
    category: "Trans",
    ageMin: 23,
    ageMax: 38,
    bioTemplate: "Perfil trans femenina con excelente presentación, atención respetuosa y muy cálida.",
    serviceTags: ["Anal", "Masajes", "Video llamadas", "Fetiches", "Dúos"]
  },
  {
    gender: "FEMALE",
    category: "Masajes",
    ageMin: 25,
    ageMax: 45,
    bioTemplate: "Masajista profesional con enfoque sensorial, higiene impecable y técnicas relajantes.",
    serviceTags: ["Masajes", "Tantra", "Descontracturante", "Atención hotel", "Video llamadas"]
  }
];

const names = [
  "Paz", "Valentina", "Camila", "Sofía", "Martina", "Antonia", "Javiera", "Renata", "Trinidad", "Florencia",
  "Catalina", "Isidora", "Amanda", "Micaela", "Fernanda", "Josefa", "Constanza", "Daniela", "Emilia", "Luna"
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function createBirthdate(age) {
  const now = new Date();
  return new Date(now.getFullYear() - age, randomInt(0, 11), randomInt(1, 28));
}

async function cleanupTestData() {
  await prisma.user.deleteMany({ where: { isTestData: true } });
}

async function seedUp() {
  await cleanupTestData();

  const passwordHash = await argon2.hash("Seed2026!");
  const tiers = [ProfessionalTier.PREMIUM, ProfessionalTier.GOLD, ProfessionalTier.SILVER];
  const profilesToCreate = 60;
  const users = [];

  for (let i = 0; i < profilesToCreate; i += 1) {
    const persona = personas[i % personas.length];
    const zone = zones[i % zones.length];
    const tier = tiers[randomInt(0, tiers.length - 1)];
    const age = randomInt(persona.ageMin, persona.ageMax);
    const firstName = names[i % names.length];
    const label = `${firstName}${String(i + 1).padStart(2, "0")}`;
    const username = `${persona.category.toLowerCase()}_${zone.city.toLowerCase().replace(/\s+/g, "")}_${i + 1}`;

    const user = await prisma.user.create({
      data: {
        email: `${username}@seed.test`,
        username,
        passwordHash,
        displayName: label,
        phone: `+569${randomInt(10000000, 99999999)}`,
        profileType: ProfileType.PROFESSIONAL,
        gender: persona.gender,
        city: zone.city,
        address: `${zone.district}, ${zone.city}`,
        latitude: zone.latitude + randomInt(-20, 20) / 1000,
        longitude: zone.longitude + randomInt(-20, 20) / 1000,
        tier,
        bio: persona.bioTemplate.replace("{district}", zone.district).replace("{city}", zone.city),
        serviceDescription: `Perfil ${persona.category} en ${zone.city} con enfoque profesional y discreto.`,
        profileTags: [persona.category, zone.city, zone.district, tier],
        serviceTags: persona.serviceTags,
        primaryCategory: persona.category,
        serviceCategory: persona.category,
        birthdate: createBirthdate(age),
        baseRate: randomInt(35000, 140000),
        minDurationMinutes: pick([30, 45, 60, 90]),
        acceptsIncalls: true,
        acceptsOutcalls: randomInt(0, 1) === 1,
        completedServices: randomInt(15, 260),
        profileViews: randomInt(200, 8000),
        isOnline: randomInt(0, 3) === 1,
        termsAcceptedAt: new Date(),
        isTestData: true
      },
      select: { id: true }
    });

    users.push(user);

    await prisma.profileMedia.create({
      data: {
        ownerId: user.id,
        type: "IMAGE",
        url: "/brand/isotipo-new.png"
      }
    });

    for (const tag of persona.serviceTags.slice(0, 3)) {
      await prisma.serviceItem.create({
        data: {
          ownerId: user.id,
          title: `${tag} ${zone.city}`,
          description: `Servicio ${tag} ofrecido por ${label} en ${zone.district}.`,
          category: persona.category,
          price: randomInt(30000, 120000),
          address: `${zone.district}, ${zone.city}`,
          latitude: zone.latitude,
          longitude: zone.longitude,
          durationMinutes: pick([30, 45, 60, 90])
        }
      });
    }
  }

  for (let i = 0; i < 10; i += 1) {
    await prisma.story.create({
      data: {
        userId: users[i].id,
        mediaUrl: "/brand/splash.jpg",
        mediaType: "IMAGE",
        expiresAt: new Date(Date.now() + (i + 1) * 6 * 60 * 60 * 1000)
      }
    });
  }

  console.log(`✅ Seed completado: ${users.length} perfiles test + 10 stories.`);
}

async function seedDown() {
  await cleanupTestData();
  console.log("✅ Seed revertido: se eliminaron usuarios con isTestData=true y sus datos relacionados.");
}

async function main() {
  const command = process.argv[2] || "up";

  if (command === "down") {
    await seedDown();
    return;
  }

  await seedUp();
}

main()
  .catch((error) => {
    console.error("❌ Error en seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
