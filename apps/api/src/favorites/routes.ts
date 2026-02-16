import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const favoritesRouter = Router();

/**
 * GET /favorites - Get user's favorites and service history
 * Only available for VIEWER profile type (clients)
 */
favoritesRouter.get("/favorites", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  
  // Check if user is a client (VIEWER profile type)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileType: true }
  });
  
  if (!user) {
    return res.status(404).json({ error: "USER_NOT_FOUND" });
  }
  
  if (user.profileType !== "VIEWER") {
    return res.status(403).json({ 
      error: "NOT_ALLOWED",
      message: "Solo los clientes pueden acceder a favoritos." 
    });
  }

  // Get favorites
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      professional: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isActive: true,
          category: {
            select: {
              name: true,
              displayName: true
            }
          },
          serviceCategory: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // Get professional ratings for favorited professionals
  const professionalIds = favorites.map(f => f.professionalId);
  const reviews = await prisma.professionalReview.findMany({
    where: {
      serviceRequest: {
        professionalId: { in: professionalIds }
      }
    },
    select: {
      hearts: true,
      serviceRequest: {
        select: { professionalId: true }
      }
    }
  });

  // Calculate average rating per professional
  const ratingByProfessional = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const pid = review.serviceRequest.professionalId;
    const current = ratingByProfessional.get(pid) || { sum: 0, count: 0 };
    ratingByProfessional.set(pid, {
      sum: current.sum + review.hearts,
      count: current.count + 1
    });
  }

  // Get completed services (service history)
  const completedServices = await prisma.serviceRequest.findMany({
    where: {
      clientId: userId,
      status: "FINALIZADO"
    },
    include: {
      professional: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          category: {
            select: {
              name: true,
              displayName: true
            }
          },
          serviceCategory: true
        }
      },
      review: {
        select: {
          hearts: true,
          comment: true,
          createdAt: true
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return res.json({
    favorites: favorites.map(fav => {
      const stats = ratingByProfessional.get(fav.professionalId);
      const rating = stats ? Math.round((stats.sum / stats.count) * 100) / 100 : null;
      
      return {
        id: fav.id,
        createdAt: fav.createdAt.toISOString(),
        professional: {
          id: fav.professional.id,
          name: fav.professional.displayName || fav.professional.username,
          avatarUrl: fav.professional.avatarUrl,
          category: fav.professional.category?.displayName || 
                   fav.professional.category?.name || 
                   fav.professional.serviceCategory || 
                   "Profesional",
          isActive: fav.professional.isActive,
          rating
        }
      };
    }),
    serviceHistory: completedServices.map(service => ({
      id: service.id,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
      requestedDate: service.requestedDate,
      requestedTime: service.requestedTime,
      agreedLocation: service.agreedLocation,
      professionalPriceClp: service.professionalPriceClp,
      professionalDurationM: service.professionalDurationM,
      professional: {
        id: service.professional.id,
        name: service.professional.displayName || service.professional.username,
        avatarUrl: service.professional.avatarUrl,
        category: service.professional.category?.displayName || 
                 service.professional.category?.name || 
                 service.professional.serviceCategory || 
                 "Profesional"
      },
      review: service.review ? {
        hearts: service.review.hearts,
        comment: service.review.comment,
        createdAt: service.review.createdAt.toISOString()
      } : null
    }))
  });
}));

/**
 * POST /favorites/:professionalId - Add a professional to favorites
 */
favoritesRouter.post("/favorites/:professionalId", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const professionalId = req.params.professionalId;

  // Check if user is a client
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileType: true }
  });

  if (!user) {
    return res.status(404).json({ error: "USER_NOT_FOUND" });
  }

  if (user.profileType !== "VIEWER") {
    return res.status(403).json({ 
      error: "NOT_ALLOWED",
      message: "Solo los clientes pueden guardar favoritos." 
    });
  }

  // Check if professional exists
  const professional = await prisma.user.findUnique({
    where: { id: professionalId },
    select: { profileType: true }
  });

  if (!professional || professional.profileType !== "PROFESSIONAL") {
    return res.status(404).json({ error: "PROFESSIONAL_NOT_FOUND" });
  }

  // Create or get existing favorite
  const favorite = await prisma.favorite.upsert({
    where: {
      userId_professionalId: {
        userId,
        professionalId
      }
    },
    create: {
      userId,
      professionalId
    },
    update: {},
    include: {
      professional: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isActive: true
        }
      }
    }
  });

  return res.json({ 
    favorite: {
      id: favorite.id,
      createdAt: favorite.createdAt.toISOString(),
      professional: {
        id: favorite.professional.id,
        name: favorite.professional.displayName || favorite.professional.username,
        avatarUrl: favorite.professional.avatarUrl,
        isActive: favorite.professional.isActive
      }
    }
  });
}));

/**
 * DELETE /favorites/:professionalId - Remove a professional from favorites
 */
favoritesRouter.delete("/favorites/:professionalId", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const professionalId = req.params.professionalId;

  // Check if user is a client
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileType: true }
  });

  if (!user) {
    return res.status(404).json({ error: "USER_NOT_FOUND" });
  }

  if (user.profileType !== "VIEWER") {
    return res.status(403).json({ 
      error: "NOT_ALLOWED",
      message: "Solo los clientes pueden gestionar favoritos." 
    });
  }

  // Delete favorite if exists
  await prisma.favorite.deleteMany({
    where: {
      userId,
      professionalId
    }
  });

  return res.json({ ok: true });
}));

/**
 * GET /favorites/check/:professionalId - Check if a professional is favorited
 */
favoritesRouter.get("/favorites/check/:professionalId", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const professionalId = req.params.professionalId;

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_professionalId: {
        userId,
        professionalId
      }
    }
  });

  return res.json({ isFavorite: !!favorite });
}));
