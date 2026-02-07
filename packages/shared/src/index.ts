import { z } from "zod";

export const Roles = z.enum(["USER", "ADMIN"]);
export type Role = z.infer<typeof Roles>;

export const ProfileTypes = z.enum(["CLIENT","VIEWER","CREATOR","PROFESSIONAL","ESTABLISHMENT","SHOP"]);
export type ProfileType = z.infer<typeof ProfileTypes>;

export const Genders = z.enum(["MALE", "FEMALE", "OTHER"]);
export type Gender = z.infer<typeof Genders>;

export const PreferenceGenders = z.enum(["MALE", "FEMALE", "ALL", "OTHER"]);
export type PreferenceGender = z.infer<typeof PreferenceGenders>;

export const registerInputSchema = z.object({
  username: z.string().min(3).max(30),
  phone: z.string().min(6).max(20),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(50).optional(),
  gender: Genders.optional(),
  profileType: ProfileTypes,
  preferenceGender: PreferenceGenders.optional(),
  address: z.string().min(6).max(200),
  acceptTerms: z.boolean().refine((v) => v === true, "Terms must be accepted"),
  birthdate: z.string().optional(),
  bio: z.string().max(1000).optional()
}).superRefine((data, ctx) => {
  if (data.profileType === "PROFESSIONAL") {
    if (!data.gender) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gender"], message: "required" });
    }
    if (!data.birthdate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["birthdate"], message: "required" });
    }
    if (!data.bio || data.bio.trim().length < 20) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bio"], message: "required" });
    }
  }
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const PostMediaType = z.enum(["IMAGE", "VIDEO"]);
export type MediaType = z.infer<typeof PostMediaType>;

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(20000),
  isPublic: z.boolean().default(false),
  price: z.number().int().min(0).max(5000).default(0)
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

// Date utils (shared between api & web)
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export type SafeUser = {
  id: string;
  email: string;
  displayName: string | null;
  username: string;
  profileType: ProfileType;
  gender: Gender | null;
  preferenceGender: PreferenceGender | null;
  role: Role;
  membershipExpiresAt: string | null;
  subscriptionPrice?: number | null;
};

export type FeedPost = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  price: number;
  media: { id: string; type: MediaType; url: string }[];
  paywalled: boolean;
};

export function isMembershipActive(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}
