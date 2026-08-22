-- Spec'ten tahmin edilen indeks. perf_index'ten AYRI tablo (K160).
-- perf_index olcum-yalnizca kalir; K71 gevsetilmedi.

CREATE TYPE "EstimateMethod" AS ENUM ('spec-model', 'family-mean');

CREATE TABLE "perf_index_estimated" (
  "id" TEXT NOT NULL,
  "part_id" TEXT NOT NULL,
  "workload" "Workload" NOT NULL,
  "index_value" DOUBLE PRECISION NOT NULL,
  "method" "EstimateMethod" NOT NULL,
  "confidence" "Confidence" NOT NULL,
  "error_band_pct" DOUBLE PRECISION NOT NULL,
  "error_band_source_family" "ArchitectureFamily",
  "n_used" INTEGER NOT NULL,
  "model_version" TEXT NOT NULL,
  "computed_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "perf_index_estimated_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "perf_index_estimated_part_id_workload_model_version_key"
  ON "perf_index_estimated"("part_id", "workload", "model_version");
CREATE INDEX "perf_index_estimated_model_version_idx"
  ON "perf_index_estimated"("model_version");

ALTER TABLE "perf_index_estimated" ADD CONSTRAINT "perf_index_estimated_part_id_fkey"
  FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
