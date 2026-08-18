-- CreateEnum
CREATE TYPE "ShaderUnitType" AS ENUM ('cuda_core', 'stream_processor', 'xe_vector_engine');

-- AlterTable
ALTER TABLE "gpu_specs" ADD COLUMN     "shader_unit_type" "ShaderUnitType";
