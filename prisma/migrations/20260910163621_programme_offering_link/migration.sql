-- CreateTable
CREATE TABLE "ref"."ProgrammeOffering" (
    "programmeId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,

    CONSTRAINT "ProgrammeOffering_pkey" PRIMARY KEY ("programmeId","offeringId")
);

-- CreateIndex
CREATE INDEX "ProgrammeOffering_offeringId_idx" ON "ref"."ProgrammeOffering"("offeringId");

-- AddForeignKey
ALTER TABLE "ref"."ProgrammeOffering" ADD CONSTRAINT "ProgrammeOffering_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "ref"."Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref"."ProgrammeOffering" ADD CONSTRAINT "ProgrammeOffering_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ref"."CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
