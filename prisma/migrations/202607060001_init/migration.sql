CREATE TABLE "ApiAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "accessLicense" TEXT,
  "secretKey" TEXT,
  "customerId" TEXT,
  "storeId" TEXT,
  "channelId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" DATETIME,
  "connectionStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "smartStoreProductId" TEXT NOT NULL,
  "originProductId" TEXT,
  "channelProductId" TEXT,
  "sellerManagementCode" TEXT,
  "currentTitle" TEXT NOT NULL,
  "originalTitle" TEXT,
  "seoOptimizedTitle" TEXT,
  "primaryKeyword" TEXT,
  "trackingKeywords" TEXT NOT NULL,
  "category" TEXT,
  "price" INTEGER NOT NULL,
  "productStatus" TEXT NOT NULL DEFAULT 'ON_SALE',
  "testStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Product_smartStoreProductId_key" ON "Product"("smartStoreProductId");

CREATE TABLE "SeoTitleCandidate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SeoTitleCandidate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TitleChangeLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "beforeTitle" TEXT NOT NULL,
  "afterTitle" TEXT NOT NULL,
  "appliedAt" DATETIME,
  "mode" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TitleChangeLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SeoExperiment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "beforeTitle" TEXT NOT NULL,
  "afterTitle" TEXT NOT NULL,
  "appliedAt" DATETIME,
  "trackingInterval" TEXT NOT NULL,
  "startDate" DATETIME NOT NULL,
  "endDate" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "summary" TEXT,
  "judgement" TEXT NOT NULL DEFAULT 'PENDING',
  "minObservationHours" INTEGER NOT NULL DEFAULT 24,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SeoExperiment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExperimentKeyword" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "experimentId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ExperimentKeyword_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "SeoExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RankTrackingJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "experimentId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" DATETIME,
  "nextRunAt" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "RankTrackingJob_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "SeoExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RankTrackingJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RankTrackingResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "trackedAt" DATETIME NOT NULL,
  "currentRank" INTEGER,
  "previousRank" INTEGER,
  "initialRank" INTEGER,
  "beforeTitleRank" INTEGER,
  "delta" INTEGER,
  "deltaStatus" TEXT NOT NULL,
  "searchPage" INTEGER,
  "foundTitle" TEXT,
  "foundProductRef" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "RankTrackingResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RankTrackingJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RankTrackingResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "SeoExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RankTrackingResult_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SystemLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "level" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metaJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
