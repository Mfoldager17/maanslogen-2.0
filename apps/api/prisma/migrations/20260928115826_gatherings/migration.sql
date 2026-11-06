-- CreateEnum
CREATE TYPE "GatheringKind" AS ENUM ('TASTING', 'FESTIVAL', 'VISIT', 'DINNER', 'OTHER');

-- CreateEnum
CREATE TYPE "GatheringStatus" AS ENUM ('PLANNED', 'LIVE', 'DONE');

-- CreateTable
CREATE TABLE "gatherings" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "GatheringKind" NOT NULL,
    "status" "GatheringStatus" NOT NULL DEFAULT 'PLANNED',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "story" TEXT,
    "held_at" TIMESTAMP(3),
    "location" TEXT,
    "host_id" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gatherings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gathering_items" (
    "id" UUID NOT NULL,
    "gathering_id" UUID NOT NULL,
    "beverage_id" UUID,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL,
    "blind" BOOLEAN NOT NULL DEFAULT false,
    "served_at" TIMESTAMP(3),
    "note" TEXT,
    "added_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gathering_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gathering_attendees" (
    "id" UUID NOT NULL,
    "gathering_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),

    CONSTRAINT "gathering_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gathering_notes" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "attendee_id" UUID NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gathering_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gatherings_slug_key" ON "gatherings"("slug");

-- CreateIndex
CREATE INDEX "gatherings_status_held_at_idx" ON "gatherings"("status", "held_at" DESC);

-- CreateIndex
CREATE INDEX "gatherings_host_id_idx" ON "gatherings"("host_id");

-- CreateIndex
CREATE INDEX "gathering_items_gathering_id_idx" ON "gathering_items"("gathering_id");

-- CreateIndex
CREATE INDEX "gathering_items_beverage_id_idx" ON "gathering_items"("beverage_id");

-- CreateIndex
CREATE UNIQUE INDEX "gathering_items_gathering_id_sort_order_key" ON "gathering_items"("gathering_id", "sort_order");

-- CreateIndex
CREATE INDEX "gathering_attendees_user_id_idx" ON "gathering_attendees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gathering_attendees_gathering_id_user_id_key" ON "gathering_attendees"("gathering_id", "user_id");

-- CreateIndex
CREATE INDEX "gathering_notes_item_id_idx" ON "gathering_notes"("item_id");

-- CreateIndex
CREATE INDEX "gathering_notes_attendee_id_idx" ON "gathering_notes"("attendee_id");

-- CreateIndex
CREATE UNIQUE INDEX "gathering_notes_item_id_attendee_id_key" ON "gathering_notes"("item_id", "attendee_id");

-- AddForeignKey
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_items" ADD CONSTRAINT "gathering_items_gathering_id_fkey" FOREIGN KEY ("gathering_id") REFERENCES "gatherings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_items" ADD CONSTRAINT "gathering_items_beverage_id_fkey" FOREIGN KEY ("beverage_id") REFERENCES "beverages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_gathering_id_fkey" FOREIGN KEY ("gathering_id") REFERENCES "gatherings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_attendees" ADD CONSTRAINT "gathering_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_notes" ADD CONSTRAINT "gathering_notes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "gathering_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_notes" ADD CONSTRAINT "gathering_notes_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "gathering_attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invarianter der hører hjemme i databasen frem for kun i applikationskoden.
-- Prisma kan ikke udtrykke CHECK-constraints i schema.prisma, så de sættes her.

-- Noternes bedømmelse følger samme skala som anmeldelser: 1-5 i halve trin.
ALTER TABLE "gathering_notes"
  ADD CONSTRAINT "gathering_notes_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5),
  ADD CONSTRAINT "gathering_notes_rating_half_step" CHECK (("rating" * 2) = floor("rating" * 2));

-- En post skal kunne identificeres: enten en drikkevare fra kataloget eller et
-- navn skrevet i farten. Uden mindst én af delene siger rækken ingenting, og
-- den ville ikke kunne vises nogen steder.
ALTER TABLE "gathering_items"
  ADD CONSTRAINT "gathering_items_identifiable"
    CHECK ("beverage_id" IS NOT NULL OR "label" IS NOT NULL);

-- Rækkefølgen begynder ved nul og går opad.
ALTER TABLE "gathering_items"
  ADD CONSTRAINT "gathering_items_sort_order_non_negative" CHECK ("sort_order" >= 0);

-- Slugs: håndhæv formatet i databasen, ikke kun i Zod.
ALTER TABLE "gatherings"
  ADD CONSTRAINT "gatherings_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
