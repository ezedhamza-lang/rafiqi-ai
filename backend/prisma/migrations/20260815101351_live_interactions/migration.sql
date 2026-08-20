-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRaisedHand" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RAISED',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loweredAt" TIMESTAMP(3),

    CONSTRAINT "LiveRaisedHand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveScreenShare" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "LiveScreenShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveChatMessage_sessionId_createdAt_idx" ON "LiveChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveRaisedHand_sessionId_status_idx" ON "LiveRaisedHand"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LiveRaisedHand_sessionId_userId_key" ON "LiveRaisedHand"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "LiveScreenShare_sessionId_idx" ON "LiveScreenShare"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveScreenShare_sessionId_userId_key" ON "LiveScreenShare"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRaisedHand" ADD CONSTRAINT "LiveRaisedHand_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRaisedHand" ADD CONSTRAINT "LiveRaisedHand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveScreenShare" ADD CONSTRAINT "LiveScreenShare_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveScreenShare" ADD CONSTRAINT "LiveScreenShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
