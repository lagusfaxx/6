/**
 * seed-test-profiles.js
 *
 * Populates the database with 60 test profiles:
 *   • 20 PROFESSIONAL
 *   • 20 ESTABLISHMENT (moteles)
 *   • 20 SHOP (sexshop)
 *
 * All profiles use the email domain @testseed.uzeed.cl so they can be
 * identified and removed in a single pass by clean-test-profiles.js.
 *
 * Usage:  node prisma/scripts/seed-test-profiles.js
 *   or:   pnpm --filter @uzeed/prisma seed:test
 */

const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

const TEST_EMAIL_DOMAIN = "@testseed.uzeed.cl";

/* ─── helpers ─────────────────────────────────────────────────── */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function birthdate(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d;
}
/** small random offset so pins don't overlap on the map */
function jitter(base, range = 0.012) {
  return base + (Math.random() - 0.5) * range;
}

/* ─── static data ─────────────────────────────────────────────── */
const CITIES = [
  { city: "Santiago",       lat: -33.4489, lng: -70.6693 },
  { city: "Providencia",    lat: -33.4328, lng: -70.6157 },
  { city: "Las Condes",     lat: -33.4103, lng: -70.5718 },
  { city: "Ñuñoa",          lat: -33.4569, lng: -70.5976 },
  { city: "Viña del Mar",   lat: -33.0153, lng: -71.5505 },
  { city: "Valparaíso",     lat: -33.0472, lng: -71.6127 },
  { city: "Concepción",     lat: -36.8270, lng: -73.0498 },
  { city: "Temuco",         lat: -38.7359, lng: -72.5904 },
  { city: "Antofagasta",    lat: -23.6509, lng: -70.3975 },
  { city: "La Serena",      lat: -29.9027, lng: -71.2520 },
];

const FEMALE_NAMES = [
  "Valentina","Camila","Isadora","Sofía","Antonella","Renata","Luna",
  "Martina","Karen","Daniela","Catalina","Fernanda","Constanza","Javiera",
  "Macarena","Belén","Rocío","Natalia","Agustina","Florencia",
];

const TIERS = ["PREMIUM", "GOLD", "SILVER"];

const PROFILE_TAG_POOL = [
  "rubia","morena","pelirroja","delgada","fitness","tetona","culona",
  "tatuada","natural","cariñosa","dominante","sumisa","piercing","caliente","trigueña",
];

const SERVICE_TAG_POOL = [
  "masaje erotico","sexo oral","anal","trios","bdsm","fetiches","videollamada",
  "packs","despedidas","lluvia dorada","rol","discapacitados",
];

const HAIR_COLORS = ["Rubio", "Castaño", "Negro", "Pelirrojo"];
const SKIN_TONES = ["Clara", "Trigueña", "Morena"];

const MOTEL_NAMES = [
  "Motel Eclipse","Motel Luna Roja","Motel Secreto","Motel Pasión",
  "Motel El Paraíso","Motel Deseo","Motel Éxtasis","Motel Tentación",
  "Motel Privé","Motel Aura","Motel Boudoir","Motel Íntimo",
  "Motel Escape","Motel Venus","Motel Seducción","Motel Fantasía",
  "Motel Encanto","Motel Rouge","Motel Midnight","Motel Amour",
];

const SHOP_NAMES = [
  "Pleasure Zone","Eros Shop","Sensual Store","Love Market",
  "Hot Spot","Deseo Íntimo","Sexy World","Passion Store",
  "Venus Shop","Erótica","Placer Shop","Fantasy Store",
  "Libido Shop","SensualMX","NightLove","Íntima Boutique",
  "Red Room Shop","Afrodita Store","Tentación Shop","Cupido Market",
];

const PRODUCT_NAMES = [
  "Vibrador clásico","Lubricante premium","Esposas de felpa","Set de lencería",
  "Aceite de masaje","Dado erótico","Venda satinada","Anillo vibrador",
  "Kit BDSM básico","Consolador realista","Bolas chinas","Plug anal",
  "Disfraz enfermera","Body de encaje","Tanga comestible","Gel retardante",
  "Preservativos premium","Succionador clitoral","Masturbador masculino","Vela de masaje",
];

/* ─── main ────────────────────────────────────────────────────── */
async function main() {
  const passwordHash = await argon2.hash("test1234");
  const membershipExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // +90 days

  // Ensure categories exist (idempotent)
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
    { name: "Productos premium", slug: "productos-premium", displayName: "Productos premium", kind: "SHOP" },
  ];
  await prisma.category.createMany({ data: categorySeeds, skipDuplicates: true });

  const proCats = await prisma.category.findMany({ where: { kind: "PROFESSIONAL" } });
  const estCats = await prisma.category.findMany({ where: { kind: "ESTABLISHMENT" } });
  const shopCats = await prisma.category.findMany({ where: { kind: "SHOP" } });

  /* ── 20 PROFESSIONAL profiles ─────────────────────────────── */
  console.log("Creating 20 PROFESSIONAL profiles …");
  for (let i = 0; i < 20; i++) {
    const name = FEMALE_NAMES[i];
    const loc = CITIES[i % CITIES.length];
    const cat = proCats[i % proCats.length];
    const tier = TIERS[i % TIERS.length];
    const age = randInt(20, 40);
    const pTags = Array.from({ length: 4 }, () => pick(PROFILE_TAG_POOL));
    const sTags = Array.from({ length: 3 }, () => pick(SERVICE_TAG_POOL));

    const user = await prisma.user.create({
      data: {
        email: `pro${i + 1}${TEST_EMAIL_DOMAIN}`,
        username: `test_pro_${name.toLowerCase()}_${i + 1}`,
        passwordHash,
        displayName: name,
        profileType: "PROFESSIONAL",
        gender: i === 14 ? "OTHER" : "FEMALE",
        city: loc.city,
        address: `Dirección privada, ${loc.city}`,
        latitude: jitter(loc.lat),
        longitude: jitter(loc.lng),
        categoryId: cat.id,
        isActive: true,
        isVerified: true,
        tier,
        isOnline: i < 10,
        lastSeen: new Date(Date.now() - i * 300_000),
        bio: `Hola soy ${name}, atención profesional y discreta en ${loc.city}. Escríbeme para coordinar.`,
        serviceDescription: `Servicio de ${cat.displayName} en ${loc.city}`,
        profileTags: [...new Set(pTags)],
        serviceTags: [...new Set(sTags)],
        baseRate: randInt(30, 120) * 1000,
        minDurationMinutes: pick([30, 60]),
        heightCm: randInt(155, 178),
        weightKg: randInt(48, 72),
        hairColor: pick(HAIR_COLORS),
        skinTone: pick(SKIN_TONES),
        birthdate: birthdate(age),
        completedServices: randInt(5, 80),
        profileViews: randInt(100, 2000),
        membershipExpiresAt,
        termsAcceptedAt: new Date(),
      },
    });

    // gallery image
    await prisma.profileMedia.create({
      data: { ownerId: user.id, type: "IMAGE", url: "/brand/isotipo-new.png" },
    });

    // service items
    for (const tag of [...new Set(sTags)].slice(0, 3)) {
      await prisma.serviceItem.create({
        data: {
          ownerId: user.id,
          title: tag.charAt(0).toUpperCase() + tag.slice(1),
          description: `Servicio de ${tag} con atención personalizada`,
          price: randInt(30, 150) * 1000,
          durationMinutes: pick([30, 60, 90]),
        },
      }).catch(() => {});
    }
  }

  /* ── 20 ESTABLISHMENT (motel) profiles ────────────────────── */
  console.log("Creating 20 ESTABLISHMENT profiles …");
  for (let i = 0; i < 20; i++) {
    const mName = MOTEL_NAMES[i];
    const loc = CITIES[i % CITIES.length];
    const cat = estCats[i % estCats.length];

    const user = await prisma.user.create({
      data: {
        email: `motel${i + 1}${TEST_EMAIL_DOMAIN}`,
        username: `test_motel_${i + 1}`,
        passwordHash,
        displayName: mName,
        profileType: "ESTABLISHMENT",
        city: loc.city,
        address: `Av. Principal ${100 + i * 10}, ${loc.city}`,
        latitude: jitter(loc.lat),
        longitude: jitter(loc.lng),
        categoryId: cat.id,
        isActive: true,
        isVerified: true,
        phone: `+56 9 ${randInt(1000, 9999)} ${randInt(1000, 9999)}`,
        bio: `${mName} — habitaciones temáticas, estacionamiento privado, máxima discreción en ${loc.city}.`,
        serviceDescription: `Motel con habitaciones por hora y packs especiales en ${loc.city}`,
        profileViews: randInt(200, 3000),
        membershipExpiresAt,
        termsAcceptedAt: new Date(),
      },
    });

    // gallery
    await prisma.profileMedia.create({
      data: { ownerId: user.id, type: "IMAGE", url: "/brand/isotipo-new.png" },
    });

    // motel rooms
    const roomNames = ["Suite Clásica", "Suite Premium", "Suite Jacuzzi"];
    for (let r = 0; r < 3; r++) {
      await prisma.motelRoom.create({
        data: {
          establishmentId: user.id,
          name: roomNames[r],
          description: `Habitación ${roomNames[r]} con todas las comodidades`,
          price: randInt(15, 60) * 1000,
        },
      }).catch(() => {});
    }

    // motel packs
    await prisma.motelPack.create({
      data: {
        establishmentId: user.id,
        name: "Pack Romántico",
        description: "Habitación + champagne + decoración",
        price: randInt(40, 80) * 1000,
      },
    }).catch(() => {});

    // motel promotion
    await prisma.motelPromotion.create({
      data: {
        establishmentId: user.id,
        title: "Promo entre semana",
        description: "30% de descuento lunes a jueves",
        discountPercent: 30,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});
  }

  /* ── 20 SHOP (sexshop) profiles ───────────────────────────── */
  console.log("Creating 20 SHOP profiles …");
  for (let i = 0; i < 20; i++) {
    const sName = SHOP_NAMES[i];
    const loc = CITIES[i % CITIES.length];
    const cat = shopCats[i % shopCats.length];

    const user = await prisma.user.create({
      data: {
        email: `shop${i + 1}${TEST_EMAIL_DOMAIN}`,
        username: `test_shop_${i + 1}`,
        passwordHash,
        displayName: sName,
        profileType: "SHOP",
        city: loc.city,
        address: `Calle Comercial ${200 + i * 5}, ${loc.city}`,
        latitude: jitter(loc.lat),
        longitude: jitter(loc.lng),
        categoryId: cat.id,
        isActive: true,
        isVerified: true,
        phone: `+56 9 ${randInt(1000, 9999)} ${randInt(1000, 9999)}`,
        bio: `${sName} — tu tienda de confianza para productos íntimos en ${loc.city}. Envíos discretos a todo Chile.`,
        serviceCategory: "sex-shop",
        profileViews: randInt(100, 1500),
        membershipExpiresAt,
        shopTrialEndsAt: membershipExpiresAt,
        termsAcceptedAt: new Date(),
      },
    });

    // gallery
    await prisma.profileMedia.create({
      data: { ownerId: user.id, type: "IMAGE", url: "/brand/isotipo-new.png" },
    });

    // products (3 per shop)
    for (let p = 0; p < 3; p++) {
      const prodName = PRODUCT_NAMES[(i * 3 + p) % PRODUCT_NAMES.length];
      await prisma.product.create({
        data: {
          shopId: user.id,
          categoryId: cat.id,
          name: prodName,
          description: `${prodName} de alta calidad`,
          price: randInt(5, 50) * 1000,
          stock: randInt(5, 100),
          isActive: true,
        },
      }).catch(() => {});
    }
  }

  console.log("✅ seed-test-profiles complete: 20 professionals + 20 moteles + 20 shops = 60 profiles");
}

main()
  .catch((err) => {
    console.error("❌ Error seeding test profiles:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
