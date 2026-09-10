-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ref";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ryc";

-- CreateTable
CREATE TABLE "platform"."Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."Member" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "emailDomain" TEXT NOT NULL,
    "displayName" TEXT,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."MemberQuota" (
    "memberId" TEXT NOT NULL,
    "windowStart" DATE NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MemberQuota_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "platform"."Session" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorMemberId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref"."Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref"."Faculty" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref"."Programme" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref"."Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref"."CourseOffering" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "ects" DECIMAL(4,2) NOT NULL,
    "language" TEXT,
    "quarter" TEXT,
    "assessment" TEXT,
    "contactHours" TEXT,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref"."OfferingFaculty" (
    "offeringId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,

    CONSTRAINT "OfferingFaculty_pkey" PRIMARY KEY ("offeringId","facultyId")
);

-- CreateTable
CREATE TABLE "ref"."OfferingTeacher" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,

    CONSTRAINT "OfferingTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ryc"."ReviewAttributed" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "recommendation" INTEGER NOT NULL,
    "workloadVsEcts" INTEGER NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "hoursPerWeek" INTEGER,
    "passed" BOOLEAN,
    "body" TEXT NOT NULL,
    "advice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',

    CONSTRAINT "ReviewAttributed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ryc"."ReviewAnonymous" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "recommendation" INTEGER NOT NULL,
    "workloadVsEcts" INTEGER NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "hoursPerWeek" INTEGER,
    "passed" BOOLEAN,
    "body" TEXT NOT NULL,
    "advice" TEXT,
    "createdAt" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',

    CONSTRAINT "ReviewAnonymous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ryc"."ReviewImported" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewImported_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Member_tenantId_idx" ON "platform"."Member"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_provider_providerSubject_key" ON "platform"."Member"("provider", "providerSubject");

-- CreateIndex
CREATE INDEX "Session_memberId_idx" ON "platform"."Session"("memberId");

-- CreateIndex
CREATE INDEX "AuditLog_actorMemberId_idx" ON "platform"."AuditLog"("actorMemberId");

-- CreateIndex
CREATE INDEX "AuditLog_targetKind_targetId_idx" ON "platform"."AuditLog"("targetKind", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_institutionId_code_key" ON "ref"."Faculty"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_code_year_key" ON "ref"."Programme"("code", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "ref"."Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_year_key" ON "ref"."CourseOffering"("courseId", "year");

-- CreateIndex
CREATE INDEX "OfferingTeacher_offeringId_idx" ON "ref"."OfferingTeacher"("offeringId");

-- CreateIndex
CREATE INDEX "ReviewAttributed_courseId_idx" ON "ryc"."ReviewAttributed"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAttributed_memberId_courseId_academicYear_key" ON "ryc"."ReviewAttributed"("memberId", "courseId", "academicYear");

-- CreateIndex
CREATE INDEX "ReviewAnonymous_courseId_idx" ON "ryc"."ReviewAnonymous"("courseId");

-- CreateIndex
CREATE INDEX "ReviewImported_courseId_idx" ON "ryc"."ReviewImported"("courseId");

-- AddForeignKey
ALTER TABLE "platform"."Member" ADD CONSTRAINT "Member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."MemberQuota" ADD CONSTRAINT "MemberQuota_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "platform"."Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."Session" ADD CONSTRAINT "Session_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "platform"."Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref"."Faculty" ADD CONSTRAINT "Faculty_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "ref"."Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref"."Programme" ADD CONSTRAINT "Programme_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "ref"."Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref"."CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ref"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref"."OfferingFaculty" ADD CONSTRAINT "OfferingFaculty_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ref"."CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref"."OfferingFaculty" ADD CONSTRAINT "OfferingFaculty_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "ref"."Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref"."OfferingTeacher" ADD CONSTRAINT "OfferingTeacher_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ref"."CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
