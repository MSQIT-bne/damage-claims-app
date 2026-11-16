-- CreateEnum
CREATE TYPE "ProcessingState" AS ENUM ('QUEUED', 'COLLECTING', 'ANALYSING', 'AWAITING_REVIEW', 'FAILED', 'FINALISED');

-- CreateEnum
CREATE TYPE "AssessmentOutcome" AS ENUM ('COMPLETE', 'INCOMPLETE', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLAIMS_STAFF', 'CLAIMS_MANAGER', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('MISSING', 'MISMATCH', 'UNCLEAR', 'EXTRACTION_FAILURE');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('OPEN', 'RESOLVED', 'WAIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLAIMS_STAFF',
    "entraId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "desk365TicketId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "claimType" TEXT NOT NULL DEFAULT 'youth-care-damage',
    "claimant" TEXT,
    "incidentDate" TIMESTAMP(3),
    "claimedAmount" DECIMAL(65,30),
    "currency" TEXT DEFAULT 'AUD',
    "desk365Status" TEXT,
    "syncTimestamp" TIMESTAMP(3),
    "processingState" "ProcessingState" NOT NULL DEFAULT 'QUEUED',
    "assessmentOutcome" "AssessmentOutcome",
    "assessmentVersion" INTEGER NOT NULL DEFAULT 0,
    "reviewerId" TEXT,
    "reviewTimestamp" TIMESTAMP(3),
    "reviewDecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "sourceAttachmentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classification" TEXT,
    "classificationConfidence" DOUBLE PRECISION,
    "extractedFields" JSONB,
    "processingErrors" JSONB,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "expectedValue" TEXT,
    "observedValue" TEXT,
    "fileIds" TEXT[],
    "pageOrRegionRefs" TEXT[],
    "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,

    CONSTRAINT "ValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "recommendedOutcome" "AssessmentOutcome" NOT NULL,
    "summary" TEXT NOT NULL,
    "rawOutput" JSONB NOT NULL,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimRule" (
    "id" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'HIGH',
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EvidenceFileToValidationIssue" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EvidenceFileToValidationIssue_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_entraId_key" ON "User"("entraId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_desk365TicketId_key" ON "Claim"("desk365TicketId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimRule_claimType_ruleId_key" ON "ClaimRule"("claimType", "ruleId");

-- CreateIndex
CREATE INDEX "_EvidenceFileToValidationIssue_B_index" ON "_EvidenceFileToValidationIssue"("B");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationIssue" ADD CONSTRAINT "ValidationIssue_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EvidenceFileToValidationIssue" ADD CONSTRAINT "_EvidenceFileToValidationIssue_A_fkey" FOREIGN KEY ("A") REFERENCES "EvidenceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EvidenceFileToValidationIssue" ADD CONSTRAINT "_EvidenceFileToValidationIssue_B_fkey" FOREIGN KEY ("B") REFERENCES "ValidationIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
