-- U-Mate: wire direct subscriptions to Flow PAC

-- Each creator gets her own Flow plan (tied to her monthly tariff)
ALTER TABLE "UmateCreator" ADD COLUMN "flowPlanId" TEXT;
CREATE UNIQUE INDEX "UmateCreator_flowPlanId_key" ON "UmateCreator"("flowPlanId");

-- Each direct subscription stores the Flow customer + subscription ids
ALTER TABLE "UmateDirectSubscription" ADD COLUMN "flowCustomerId" TEXT;
ALTER TABLE "UmateDirectSubscription" ADD COLUMN "flowSubscriptionId" TEXT;
CREATE UNIQUE INDEX "UmateDirectSubscription_flowSubscriptionId_key" ON "UmateDirectSubscription"("flowSubscriptionId");
