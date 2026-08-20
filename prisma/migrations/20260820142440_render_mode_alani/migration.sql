-- CreateEnum
CREATE TYPE "RenderMode" AS ENUM ('raster', 'raytracing', 'pathtracing');

-- AlterTable
ALTER TABLE "benchmark_points" ADD COLUMN     "render_mode" "RenderMode" NOT NULL DEFAULT 'raster';
