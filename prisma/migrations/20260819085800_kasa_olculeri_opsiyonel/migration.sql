-- AlterTable
ALTER TABLE "case_specs" ALTER COLUMN "max_gpu_length_mm" DROP NOT NULL,
ALTER COLUMN "max_cpu_cooler_height_mm" DROP NOT NULL,
ALTER COLUMN "max_psu_length_mm" DROP NOT NULL;
