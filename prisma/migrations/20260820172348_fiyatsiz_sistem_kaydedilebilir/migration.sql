-- AlterTable
ALTER TABLE "build_items" ALTER COLUMN "unit_price_minor_at_save" DROP NOT NULL;

-- AlterTable
ALTER TABLE "builds" ALTER COLUMN "total_price_minor" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL;
