-- AlterTable
ALTER TABLE "gpu_specs" ADD COLUMN     "boost_clock_mhz" INTEGER,
ADD COLUMN     "memory_bandwidth_gbs" DOUBLE PRECISION,
ADD COLUMN     "shader_units" INTEGER;
