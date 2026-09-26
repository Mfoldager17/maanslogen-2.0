-- Invarianter der hører hjemme i databasen frem for kun i applikationskoden.
-- Prisma kan ikke udtrykke CHECK-constraints i schema.prisma, så de sættes her.

-- Bedømmelser: 1-5 i halve trin.
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5),
  ADD CONSTRAINT "reviews_rating_half_step" CHECK (("rating" * 2) = floor("rating" * 2));

-- Denormaliseret gennemsnit kan aldrig komme uden for skalaen, og antallet aldrig blive negativt.
ALTER TABLE "beverages"
  ADD CONSTRAINT "beverages_rating_average_range" CHECK ("rating_average" >= 0 AND "rating_average" <= 5),
  ADD CONSTRAINT "beverages_rating_count_non_negative" CHECK ("rating_count" >= 0);

-- Landekoder gemmes altid i versaler, så sammenligninger er forudsigelige.
ALTER TABLE "brands"
  ADD CONSTRAINT "brands_country_code_upper" CHECK ("country_code" IS NULL OR "country_code" = upper("country_code"));
ALTER TABLE "beverages"
  ADD CONSTRAINT "beverages_country_code_upper" CHECK ("country_code" IS NULL OR "country_code" = upper("country_code"));

-- Slugs: håndhæv formatet i databasen, ikke kun i Zod.
ALTER TABLE "beverage_categories"
  ADD CONSTRAINT "beverage_categories_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "beverage_types"
  ADD CONSTRAINT "beverage_types_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "brands"
  ADD CONSTRAINT "brands_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "beverages"
  ADD CONSTRAINT "beverages_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Attributnøgler er snake_case og kan ikke ændres efter oprettelse.
ALTER TABLE "attribute_definitions"
  ADD CONSTRAINT "attribute_definitions_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]*$');

-- Fritekstsøgning: trigram-indeks gør ILIKE '%term%' hurtigt uden en separat søgemaskine.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "beverages_name_trgm_idx" ON "beverages" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "brands_name_trgm_idx" ON "brands" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "beverage_types_name_trgm_idx" ON "beverage_types" USING GIN ("name" gin_trgm_ops);

-- Kun ét aktivt medie-asset pr. rendition-nøgle; hjælper oprydningsjobbet med at
-- afgøre om en nøgle i objektlageret stadig er i brug.
CREATE INDEX "media_renditions_storage_key_idx" ON "media_renditions" ("storage_key");
