-- Imported reviews can be held. FR-E8, FR-E11.
--
-- `ReviewImported` had no `status`, so the one thing the moderation mechanism
-- could not do was hide an imported review, and the read path returned them
-- whatever happened. Content this platform hosts and cannot act on is exactly
-- the gap DSA Article 16 exists to close, and it is worse for this kind than
-- the others: imported text was written elsewhere under other norms, arrives in
-- bulk rather than one considered submission at a time, and is the material
-- most likely to name a lecturer who never agreed to be named.
--
-- Found by the notice and action tests failing against a real database rather
-- than by reading the schema. The three review tables had been assumed alike.

ALTER TABLE "ryc"."ReviewImported"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';
