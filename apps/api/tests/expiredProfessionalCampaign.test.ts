import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import type { BillingSettings } from "../src/lib/billingSettings";
import {
  expiredProfessionalsWhere,
  reviewedRecipientsSchema,
  sendExpiredProfessionalCampaign,
} from "../src/lib/expiredProfessionalCampaign";

const DAY = 86_400_000;
const now = new Date("2026-11-05T15:00:00.000Z");
const settings: BillingSettings = {
  enabled: true, enabledAt: new Date("2026-10-01T00:00:00Z"),
  graceDays: 7, trialDays: 30, priceClp: 45_000,
  flowPlanId: "test", flowPlanPriceClp: null, receiptWhatsapp: "",
};

function professional(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "professional@example.test", profileType: "PROFESSIONAL",
    isActive: true, isVerified: true, deletedAt: null, adminManaged: false,
    createdAt: new Date(now.getTime() - 90 * DAY),
    membershipExpiresAt: null, shopTrialEndsAt: null,
    ...overrides,
  };
}

// Generic evaluator of the Prisma filter operators used here. Fixtures describe
// account states independently of the filter, including SQL-null alternatives.
function matches(row: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return condition.every((c: any) => matches(row, c));
    if (key === "OR") return condition.some((c: any) => matches(row, c));
    if (key === "NOT") return !matches(row, condition);
    const value = row[key];
    if (condition === null || typeof condition !== "object") return value === condition;
    return Object.entries(condition).every(([operator, target]: [string, any]) => {
      if (operator === "mode") return true;
      if (value === null || value === undefined) return false;
      if (operator === "lte") return value <= target;
      if (operator === "contains") {
        return condition.mode === "insensitive"
          ? value.toLowerCase().includes(target.toLowerCase()) : value.includes(target);
      }
      throw new Error(`Unsupported filter operator: ${operator}`);
    });
  });
}

const eligibilityCases: [string, Record<string, unknown>, boolean][] = [
  ["expired free access", {}, true],
  ["paid membership in force", { membershipExpiresAt: new Date(now.getTime() + 1) }, false],
  ["explicit trial in force", { shopTrialEndsAt: new Date(now.getTime() + 1) }, false],
  ["registration trial in force even with old explicit trial", {
    createdAt: new Date(now.getTime() - 10 * DAY), shopTrialEndsAt: new Date(now.getTime() - DAY),
  }, false],
  ["expired membership and trial", {
    membershipExpiresAt: new Date(now.getTime() - DAY), shopTrialEndsAt: new Date(now.getTime() - DAY),
  }, true],
  ["expiry equal to now", {
    createdAt: new Date(now.getTime() - 30 * DAY),
    membershipExpiresAt: now, shopTrialEndsAt: now,
  }, true],
  ["registration trial with one millisecond left", { createdAt: new Date(now.getTime() - 30 * DAY + 1) }, false],
  ["client", { profileType: "CLIENT" }, false],
  ["viewer", { profileType: "VIEWER" }, false],
  ["creator", { profileType: "CREATOR" }, false],
  ["shop", { profileType: "SHOP" }, false],
  ["establishment", { profileType: "ESTABLISHMENT" }, false],
  ["manually disabled", { isActive: false }, false],
  ["not approved", { isVerified: false }, false],
  ["deleted", { deletedAt: now }, false],
  ["admin managed", { adminManaged: true }, false],
  ["placeholder address", { email: "admin@PLACEHOLDER.UZEED.CL" }, false],
];

for (const [name, overrides, expected] of eligibilityCases) {
  test(`audience: ${name}`, () => {
    const where = expiredProfessionalsWhere(settings, now);
    assert.ok(where);
    assert.equal(matches(professional(overrides), where), expected);
  });
}

for (const [name, patch] of [
  ["billing disabled", { enabled: false }],
  ["global grace ongoing", { enabledAt: new Date(now.getTime() - DAY) }],
  ["missing enable date", { enabledAt: null }],
  ["invalid enable date", { enabledAt: new Date("invalid") }],
  ["invalid trial days", { trialDays: NaN }],
] as const) {
  test(`no audience when ${name}`, () => {
    assert.equal(expiredProfessionalsWhere({ ...settings, ...patch }, now), null);
  });
}

test("global grace expiry boundary and configurable trial duration", () => {
  const billing = { ...settings, enabledAt: new Date(now.getTime() - 7 * DAY), trialDays: 60 };
  const where = expiredProfessionalsWhere(billing, now);
  assert.ok(where);
  assert.equal(matches(professional({ createdAt: new Date(now.getTime() - 45 * DAY) }), where), false);
});

test("sending requires valid, nonempty reviewed IDs and email addresses", () => {
  for (const input of [undefined, [], [{ email: "a@example.test" }], [{ id: "bad", email: "bad" }]]) {
    assert.equal(reviewedRecipientsSchema.safeParse(input).success, false);
  }
  assert.equal(reviewedRecipientsSchema.safeParse([professional()]).success, true);
});

function harness(rows = [professional()]) {
  let billing = settings;
  let databaseFails = false;
  const delivered: string[] = [];
  const deps = {
    now: () => now,
    loadSettings: async () => {
      if (databaseFails) throw new Error("DB unavailable");
      return billing;
    },
    findEligible: async (r: { id: string; email: string }, where: any) => rows.some(
      (row) => row.id === r.id && row.email === r.email && matches(row, where),
    ),
    send: async (email: string) => { delivered.push(email); },
  };
  return { deps, delivered, setBilling: (s: BillingSettings) => { billing = s; }, failDatabase: () => { databaseFails = true; } };
}

test("only reviewed recipients are sent; newly expired users are not added", async () => {
  const first = professional();
  const second = professional({ id: "00000000-0000-4000-8000-000000000002", email: "other@example.test" });
  const h = harness([first, second]);
  const result = await sendExpiredProfessionalCampaign([first], h.deps);
  assert.deepEqual(h.delivered, [first.email]);
  assert.equal(result.sent, 1);
  assert.equal(result.total, 1);
});

for (const [name, change] of [
  ["payment received", { membershipExpiresAt: new Date(now.getTime() + DAY) }],
  ["trial extended", { shopTrialEndsAt: new Date(now.getTime() + DAY) }],
  ["account disabled", { isActive: false }],
  ["email changed", { email: "new@example.test" }],
] as const) {
  test(`revalidation skips when ${name} after review`, async () => {
    const reviewed = professional();
    const h = harness([professional(change)]);
    const result = await sendExpiredProfessionalCampaign([reviewed], h.deps);
    assert.deepEqual(h.delivered, []);
    assert.equal(result.skipped, 1);
  });
}

test("billing changes during a campaign stop later recipients", async () => {
  const first = professional();
  const second = professional({ id: "00000000-0000-4000-8000-000000000002", email: "other@example.test" });
  const h = harness([first, second]);
  const result = await sendExpiredProfessionalCampaign([first, second], {
    ...h.deps,
    send: async (email) => { h.delivered.push(email); h.setBilling({ ...settings, enabled: false }); },
  });
  assert.deepEqual(h.delivered, [first.email]);
  assert.equal(result.skipped, 1);
});

test("DB failures fail closed with explicit unattempted count", async () => {
  const h = harness();
  h.failDatabase();
  const result = await sendExpiredProfessionalCampaign([professional()], h.deps);
  assert.deepEqual(h.delivered, []);
  assert.equal(result.stopped, true);
  assert.equal(result.notAttempted, 1);
  assert.equal(result.sent, 0);
});

test("account recheck failure also prevents sending", async () => {
  const h = harness();
  const result = await sendExpiredProfessionalCampaign([professional()], {
    ...h.deps, findEligible: async () => { throw new Error("DB unavailable"); },
  });
  assert.deepEqual(h.delivered, []);
  assert.equal(result.stopped, true);
});

test("duplicate IDs and email addresses are skipped within a campaign", async () => {
  const row = professional();
  const h = harness();
  const result = await sendExpiredProfessionalCampaign([row, row, { ...row, id: "other-id" }], h.deps);
  assert.deepEqual(h.delivered, [row.email]);
  assert.equal(result.skipped, 2);
});

test("provider rejection is a failure, not a successful delivery", async () => {
  const h = harness();
  const result = await sendExpiredProfessionalCampaign([professional()], {
    ...h.deps, send: async () => { throw new Error("BULK_PAUSED"); },
  });
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
});

test("actual campaign mail adapter rejects when no provider is configured (no network)", () => {
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { sendCampaignEmail } from './src/lib/notificationEmail.ts';
    await assert.rejects(sendCampaignEmail('nobody@example.test', 'Test', '<p>Test</p>'), /RESEND_NOT_CONFIGURED/);
  `], {
    encoding: "utf8",
    env: { ...process.env, RESEND_API_KEY: "", SMTP_HOST: "", SMTP_PASS: "",
      APP_URL: "http://localhost:3000", API_URL: "http://localhost:3001",
      DATABASE_URL: "postgresql://unused@localhost/unused", SESSION_SECRET: "test-only", ADMIN_PASSWORD: "test-only" },
  });
  assert.equal(child.status, 0, child.stderr);
});
