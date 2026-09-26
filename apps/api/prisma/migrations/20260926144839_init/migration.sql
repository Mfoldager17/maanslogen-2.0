-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'ENUM', 'MULTI_ENUM');

-- CreateEnum
CREATE TYPE "QuestionAnswerType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SCALE', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "MediaVariant" AS ENUM ('THUMB', 'CARD', 'FULL', 'AVATAR');

-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('BEVERAGE', 'BRAND', 'CATEGORY', 'USER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "avatar_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_type" "MediaOwnerType" NOT NULL,
    "alt" TEXT,
    "blurhash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_renditions" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "variant" "MediaVariant" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_renditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_uploads" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beverage_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "accent_color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "media_id" UUID,

    CONSTRAINT "beverage_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beverage_types" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "beverage_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country_code" CHAR(2),
    "website_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "media_id" UUID,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beverages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country_code" CHAR(2),
    "vintage" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "type_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "media_id" UUID,
    "rating_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_buckets" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "beverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "data_type" "AttributeDataType" NOT NULL,
    "unit" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "rules" JSONB,
    "options" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beverage_attribute_values" (
    "id" UUID NOT NULL,
    "beverage_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "value_text" TEXT,
    "value_number" DOUBLE PRECISION,
    "value_boolean" BOOLEAN,
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beverage_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "help_text" TEXT,
    "answer_type" "QuestionAnswerType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "scale" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "beverage_id" UUID NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_answers" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value_text" TEXT,
    "value_number" DOUBLE PRECISION,
    "value_boolean" BOOLEAN,
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BrandCategories" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BrandCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_QuestionCategories" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_QuestionCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_QuestionTypes" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_QuestionTypes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AttributeCategories" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AttributeCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AttributeTypes" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AttributeTypes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatar_id_key" ON "users"("avatar_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "media_assets_owner_type_idx" ON "media_assets"("owner_type");

-- CreateIndex
CREATE INDEX "media_renditions_asset_id_idx" ON "media_renditions"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_renditions_asset_id_variant_key" ON "media_renditions"("asset_id", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "media_renditions_storage_key_key" ON "media_renditions"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "pending_uploads_storage_key_key" ON "pending_uploads"("storage_key");

-- CreateIndex
CREATE INDEX "pending_uploads_expires_at_idx" ON "pending_uploads"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "beverage_categories_slug_key" ON "beverage_categories"("slug");

-- CreateIndex
CREATE INDEX "beverage_categories_active_sort_order_idx" ON "beverage_categories"("active", "sort_order");

-- CreateIndex
CREATE INDEX "beverage_categories_deleted_at_idx" ON "beverage_categories"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "beverage_types_slug_key" ON "beverage_types"("slug");

-- CreateIndex
CREATE INDEX "beverage_types_category_id_active_sort_order_idx" ON "beverage_types"("category_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "beverage_types_deleted_at_idx" ON "beverage_types"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "beverage_types_category_id_name_key" ON "beverage_types"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_active_name_idx" ON "brands"("active", "name");

-- CreateIndex
CREATE INDEX "brands_deleted_at_idx" ON "brands"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "beverages_slug_key" ON "beverages"("slug");

-- CreateIndex
CREATE INDEX "beverages_type_id_active_idx" ON "beverages"("type_id", "active");

-- CreateIndex
CREATE INDEX "beverages_brand_id_idx" ON "beverages"("brand_id");

-- CreateIndex
CREATE INDEX "beverages_active_created_at_idx" ON "beverages"("active", "created_at" DESC);

-- CreateIndex
CREATE INDEX "beverages_active_rating_average_idx" ON "beverages"("active", "rating_average" DESC);

-- CreateIndex
CREATE INDEX "beverages_deleted_at_idx" ON "beverages"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "beverages_brand_id_name_vintage_key" ON "beverages"("brand_id", "name", "vintage");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_key_key" ON "attribute_definitions"("key");

-- CreateIndex
CREATE INDEX "attribute_definitions_filterable_idx" ON "attribute_definitions"("filterable");

-- CreateIndex
CREATE INDEX "attribute_definitions_sort_order_idx" ON "attribute_definitions"("sort_order");

-- CreateIndex
CREATE INDEX "attribute_definitions_deleted_at_idx" ON "attribute_definitions"("deleted_at");

-- CreateIndex
CREATE INDEX "beverage_attribute_values_beverage_id_idx" ON "beverage_attribute_values"("beverage_id");

-- CreateIndex
CREATE INDEX "beverage_attribute_values_definition_id_value_text_idx" ON "beverage_attribute_values"("definition_id", "value_text");

-- CreateIndex
CREATE INDEX "beverage_attribute_values_definition_id_value_number_idx" ON "beverage_attribute_values"("definition_id", "value_number");

-- CreateIndex
CREATE INDEX "beverage_attribute_values_definition_id_value_boolean_idx" ON "beverage_attribute_values"("definition_id", "value_boolean");

-- CreateIndex
CREATE UNIQUE INDEX "beverage_attribute_values_beverage_id_definition_id_key" ON "beverage_attribute_values"("beverage_id", "definition_id");

-- CreateIndex
CREATE INDEX "questions_active_sort_order_idx" ON "questions"("active", "sort_order");

-- CreateIndex
CREATE INDEX "questions_deleted_at_idx" ON "questions"("deleted_at");

-- CreateIndex
CREATE INDEX "reviews_beverage_id_created_at_idx" ON "reviews"("beverage_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_user_id_created_at_idx" ON "reviews"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_deleted_at_idx" ON "reviews"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_beverage_id_key" ON "reviews"("user_id", "beverage_id");

-- CreateIndex
CREATE INDEX "review_answers_review_id_idx" ON "review_answers"("review_id");

-- CreateIndex
CREATE INDEX "review_answers_question_id_idx" ON "review_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_answers_review_id_question_id_key" ON "review_answers"("review_id", "question_id");

-- CreateIndex
CREATE INDEX "_BrandCategories_B_index" ON "_BrandCategories"("B");

-- CreateIndex
CREATE INDEX "_QuestionCategories_B_index" ON "_QuestionCategories"("B");

-- CreateIndex
CREATE INDEX "_QuestionTypes_B_index" ON "_QuestionTypes"("B");

-- CreateIndex
CREATE INDEX "_AttributeCategories_B_index" ON "_AttributeCategories"("B");

-- CreateIndex
CREATE INDEX "_AttributeTypes_B_index" ON "_AttributeTypes"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_renditions" ADD CONSTRAINT "media_renditions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beverage_categories" ADD CONSTRAINT "beverage_categories_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beverage_types" ADD CONSTRAINT "beverage_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "beverage_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beverages" ADD CONSTRAINT "beverages_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "beverage_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beverages" ADD CONSTRAINT "beverages_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beverages" ADD CONSTRAINT "beverages_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beverage_attribute_values" ADD CONSTRAINT "beverage_attribute_values_beverage_id_fkey" FOREIGN KEY ("beverage_id") REFERENCES "beverages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beverage_attribute_values" ADD CONSTRAINT "beverage_attribute_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_beverage_id_fkey" FOREIGN KEY ("beverage_id") REFERENCES "beverages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BrandCategories" ADD CONSTRAINT "_BrandCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "beverage_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BrandCategories" ADD CONSTRAINT "_BrandCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionCategories" ADD CONSTRAINT "_QuestionCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "beverage_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionCategories" ADD CONSTRAINT "_QuestionCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionTypes" ADD CONSTRAINT "_QuestionTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "beverage_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionTypes" ADD CONSTRAINT "_QuestionTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttributeCategories" ADD CONSTRAINT "_AttributeCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttributeCategories" ADD CONSTRAINT "_AttributeCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "beverage_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttributeTypes" ADD CONSTRAINT "_AttributeTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttributeTypes" ADD CONSTRAINT "_AttributeTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "beverage_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
