-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'STB', 'DEMO');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'DEMO',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "providerReference" TEXT,
    "checkoutUrl" TEXT,
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    "metadata" JSONB,
    "failureMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerReference_key" ON "PaymentIntent"("providerReference");

-- CreateIndex
CREATE INDEX "PaymentIntent_userId_idx" ON "PaymentIntent"("userId");

-- CreateIndex
CREATE INDEX "PaymentIntent_subscriptionId_idx" ON "PaymentIntent"("subscriptionId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
