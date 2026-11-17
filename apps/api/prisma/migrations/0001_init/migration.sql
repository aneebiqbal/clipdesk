-- CreateEnum
CREATE TYPE "Status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'QUEUED',
    "sourceFile" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "duration" DOUBLE PRECISION,
    "clipCount" INTEGER NOT NULL DEFAULT 3,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "progress" JSONB,
    "waveform" JSONB,
    "moments" JSONB,
    "runName" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "thumbPath" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hook" TEXT,
    "outro" TEXT,
    "sourceStart" DOUBLE PRECISION NOT NULL,
    "sourceEnd" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "musicTrack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "clips" INTEGER NOT NULL DEFAULT 3,
    "voice" BOOLEAN NOT NULL DEFAULT true,
    "music" BOOLEAN NOT NULL DEFAULT true,
    "geminiKey" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

