-- A suspension binds an account, never a person (FR-A6, OPEN-35), and cannot
-- reach the anonymous path (FR-E7). Nullable throughout: every existing member
-- is not suspended, which is the correct answer for all of them.
ALTER TABLE "platform"."Member" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "platform"."Member" ADD COLUMN "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "platform"."Member" ADD COLUMN "suspendedReason" TEXT;

-- Settings an administrator may change while the platform runs. The key is
-- namespaced by module and the platform never learns what it means.
CREATE TABLE "platform"."Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
