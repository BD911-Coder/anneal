-- CreateEnum
CREATE TYPE "Source" AS ENUM ('manual', 'dev-seed', 'manufacturer', 'affiliate', 'user', 'import');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "PartCategory" AS ENUM ('gpu', 'cpu', 'motherboard', 'ram', 'psu', 'storage', 'case');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('DDR4', 'DDR5');

-- CreateEnum
CREATE TYPE "CpuMemoryType" AS ENUM ('DDR4', 'DDR5', 'DDR4/DDR5');

-- CreateEnum
CREATE TYPE "FormFactor" AS ENUM ('ATX', 'mATX', 'ITX', 'E-ATX');

-- CreateEnum
CREATE TYPE "Modularity" AS ENUM ('full', 'semi', 'none');

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('nvme', 'sata-ssd', 'hdd');

-- CreateEnum
CREATE TYPE "Resolution" AS ENUM ('1080p', '1440p', '2160p');

-- CreateEnum
CREATE TYPE "Preset" AS ENUM ('low', 'medium', 'high', 'ultra');

-- CreateEnum
CREATE TYPE "BenchmarkSourceType" AS ENUM ('review', 'user_submission', 'own_test');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "category" "PartCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "release_year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpu_specs" (
    "part_id" TEXT NOT NULL,
    "chipset" TEXT NOT NULL,
    "vram_gb" INTEGER NOT NULL,
    "vram_type" TEXT NOT NULL,
    "tdp_watt" INTEGER NOT NULL,
    "length_mm" INTEGER NOT NULL,
    "recommended_psu_watt" INTEGER NOT NULL,
    "pcie_version" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gpu_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "cpu_specs" (
    "part_id" TEXT NOT NULL,
    "socket" TEXT NOT NULL,
    "cores" INTEGER NOT NULL,
    "threads" INTEGER NOT NULL,
    "base_clock_mhz" INTEGER NOT NULL,
    "boost_clock_mhz" INTEGER NOT NULL,
    "tdp_watt" INTEGER NOT NULL,
    "memory_type" "CpuMemoryType" NOT NULL,
    "has_igpu" BOOLEAN NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cpu_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "motherboard_specs" (
    "part_id" TEXT NOT NULL,
    "socket" TEXT NOT NULL,
    "chipset" TEXT NOT NULL,
    "form_factor" "FormFactor" NOT NULL,
    "memory_type" "MemoryType" NOT NULL,
    "memory_slots" INTEGER NOT NULL,
    "max_memory_gb" INTEGER NOT NULL,
    "max_memory_speed_mhz" INTEGER NOT NULL,
    "m2_slots" INTEGER NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "motherboard_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "ram_specs" (
    "part_id" TEXT NOT NULL,
    "memory_type" "MemoryType" NOT NULL,
    "capacity_gb" INTEGER NOT NULL,
    "module_count" INTEGER NOT NULL,
    "speed_mhz" INTEGER NOT NULL,
    "cas_latency" INTEGER NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ram_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "psu_specs" (
    "part_id" TEXT NOT NULL,
    "wattage" INTEGER NOT NULL,
    "efficiency_rating" TEXT NOT NULL,
    "modularity" "Modularity" NOT NULL,
    "length_mm" INTEGER NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "psu_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "storage_specs" (
    "part_id" TEXT NOT NULL,
    "storage_type" "StorageType" NOT NULL,
    "capacity_gb" INTEGER NOT NULL,
    "interface" TEXT NOT NULL,
    "read_speed_mbs" INTEGER,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "storage_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "case_specs" (
    "part_id" TEXT NOT NULL,
    "supported_form_factors" "FormFactor"[],
    "max_gpu_length_mm" INTEGER NOT NULL,
    "max_cpu_cooler_height_mm" INTEGER NOT NULL,
    "max_psu_length_mm" INTEGER NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "case_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "in_stock" BOOLEAN,
    "product_url" TEXT,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "release_year" INTEGER NOT NULL,
    "gpu_weight" DOUBLE PRECISION NOT NULL,
    "cpu_weight" DOUBLE PRECISION NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_points" (
    "id" TEXT NOT NULL,
    "gpu_part_id" TEXT NOT NULL,
    "cpu_part_id" TEXT,
    "game_id" TEXT NOT NULL,
    "resolution" "Resolution" NOT NULL,
    "preset" "Preset" NOT NULL,
    "upscaling" TEXT,
    "avg_fps" DOUBLE PRECISION NOT NULL,
    "one_percent_low_fps" DOUBLE PRECISION,
    "source_type" "BenchmarkSourceType" NOT NULL,
    "source" "Source" NOT NULL,
    "source_url" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perf_index" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "index_value" DOUBLE PRECISION NOT NULL,
    "model_version" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perf_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "total_price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "perf_index_snapshot" DOUBLE PRECISION NOT NULL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_items" (
    "build_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_minor_at_save" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "build_items_pkey" PRIMARY KEY ("build_id","part_id")
);

-- CreateTable
CREATE TABLE "raw_imports" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "raw_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "build_id" TEXT,
    "target_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "build_id" TEXT,
    "page_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parts_category_idx" ON "parts"("category");

-- CreateIndex
CREATE INDEX "parts_source_idx" ON "parts"("source");

-- CreateIndex
CREATE INDEX "price_snapshots_part_id_collected_at_idx" ON "price_snapshots"("part_id", "collected_at");

-- CreateIndex
CREATE INDEX "benchmark_points_gpu_part_id_game_id_resolution_idx" ON "benchmark_points"("gpu_part_id", "game_id", "resolution");

-- CreateIndex
CREATE UNIQUE INDEX "perf_index_part_id_model_version_key" ON "perf_index"("part_id", "model_version");

-- AddForeignKey
ALTER TABLE "gpu_specs" ADD CONSTRAINT "gpu_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpu_specs" ADD CONSTRAINT "cpu_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motherboard_specs" ADD CONSTRAINT "motherboard_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ram_specs" ADD CONSTRAINT "ram_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psu_specs" ADD CONSTRAINT "psu_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_specs" ADD CONSTRAINT "storage_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_specs" ADD CONSTRAINT "case_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_points" ADD CONSTRAINT "benchmark_points_gpu_part_id_fkey" FOREIGN KEY ("gpu_part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_points" ADD CONSTRAINT "benchmark_points_cpu_part_id_fkey" FOREIGN KEY ("cpu_part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_points" ADD CONSTRAINT "benchmark_points_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perf_index" ADD CONSTRAINT "perf_index_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
