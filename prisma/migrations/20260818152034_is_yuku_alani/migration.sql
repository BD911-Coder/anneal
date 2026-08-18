-- Is yuku alani (workload) — SCHEMA.md v1.2, docs/KARARLAR.md K35.
--
-- Bu migration elle yazildi. Prisma'nin urettigi hali calismiyordu: perf_index
-- tablosunda 8 satir var ve varsayilani olmayan zorunlu bir sutun eklenemez.
-- Cozum, sutunu gecici bir varsayilanla ekleyip hemen ardindan varsayilani
-- dusurmek — boylece mevcut satirlar dolar ama semada varsayilan kalmaz.
--
-- Varsayilanin semada kalmamasi bilincli (K35): varsayilan olsaydi, is yukunu
-- soylemeyi unutan bir kayit sessizce 'gaming' etiketi alirdi.

-- CreateEnum
CREATE TYPE "Workload" AS ENUM ('gaming', 'ai_inference', 'video_encode', 'productivity');

-- AlterTable: benchmark_points
-- Tablo su an bos; yine de ayni yol izlendi ki migration bos olmayan bir
-- veritabaninda da calissin.
ALTER TABLE "benchmark_points" ADD COLUMN "workload" "Workload" NOT NULL DEFAULT 'gaming';
ALTER TABLE "benchmark_points" ALTER COLUMN "workload" DROP DEFAULT;

-- AlterTable: perf_index
-- Mevcut 8 satir gercekten oyun indeksi — 'gaming' uydurma bir etiket degil.
ALTER TABLE "perf_index" ADD COLUMN "workload" "Workload" NOT NULL DEFAULT 'gaming';
ALTER TABLE "perf_index" ALTER COLUMN "workload" DROP DEFAULT;

-- DropIndex
-- Eski tekillik: (part_id, model_version) — K14.
DROP INDEX "perf_index_part_id_model_version_key";

-- CreateIndex
-- Yeni tekillik: (part_id, workload, model_version) — K35.
CREATE UNIQUE INDEX "perf_index_part_id_workload_model_version_key" ON "perf_index"("part_id", "workload", "model_version");
