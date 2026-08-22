-- AlterTable
ALTER TABLE "cpu_specs" ADD COLUMN     "l3_cache_mb" INTEGER;

-- AlterTable
ALTER TABLE "gpu_specs" ADD COLUMN     "architecture_family" TEXT,
ADD COLUMN     "bus_width_bits" INTEGER;
