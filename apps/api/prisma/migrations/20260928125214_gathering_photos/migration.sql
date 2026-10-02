-- CreateTable
CREATE TABLE "gathering_photos" (
    "id" UUID NOT NULL,
    "gathering_id" UUID NOT NULL,
    "item_id" UUID,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gathering_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gathering_photos_storage_key_key" ON "gathering_photos"("storage_key");

-- CreateIndex
CREATE INDEX "gathering_photos_gathering_id_sort_order_idx" ON "gathering_photos"("gathering_id", "sort_order");

-- CreateIndex
CREATE INDEX "gathering_photos_item_id_idx" ON "gathering_photos"("item_id");

-- CreateIndex
CREATE INDEX "gathering_photos_uploaded_by_id_idx" ON "gathering_photos"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "gathering_photos" ADD CONSTRAINT "gathering_photos_gathering_id_fkey" FOREIGN KEY ("gathering_id") REFERENCES "gatherings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_photos" ADD CONSTRAINT "gathering_photos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "gathering_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gathering_photos" ADD CONSTRAINT "gathering_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Håndskrevne constraints. Prisma kan ikke udtrykke CHECK, og de her er
-- netop dem der ikke må kunne omgås ved en fejl i et servicelag.

-- Nøglen dannes altid i backenden med præfikset "arrangementer/". Står der
-- noget andet i rækken, peger den et sted klienten har valgt — og så er
-- signeringen ikke længere begrænset til arrangementernes egne objekter.
ALTER TABLE "gathering_photos"
  ADD CONSTRAINT "gathering_photos_storage_key_prefix"
  CHECK ("storage_key" LIKE 'arrangementer/%');

-- Kun billedtyper, og kun de fire som kontrakten tillader. Ville en anden type
-- kunne ligge her, ville en signeret URL kunne servere fx en HTML-fil fra
-- vores eget domæne.
ALTER TABLE "gathering_photos"
  ADD CONSTRAINT "gathering_photos_content_type"
  CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif'));

ALTER TABLE "gathering_photos"
  ADD CONSTRAINT "gathering_photos_sort_order_non_negative"
  CHECK ("sort_order" >= 0);
