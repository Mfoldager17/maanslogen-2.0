-- En note kan blive til skriverens anmeldelse af drikkevaren. Koblingen står
-- på noten, ikke på anmeldelsen: det er noten der bliver forfremmet, og
-- unikhedskravet sikrer at den samme note ikke kan blive til to.
--
-- SetNull frem for Cascade: sletter man sin anmeldelse, skal aftenens note
-- ikke forsvinde med den. Den bliver hvad den var — hvad man syntes dén aften.

-- AlterTable
ALTER TABLE "gathering_notes" ADD COLUMN     "review_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "gathering_notes_review_id_key" ON "gathering_notes"("review_id");

-- AddForeignKey
ALTER TABLE "gathering_notes" ADD CONSTRAINT "gathering_notes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
