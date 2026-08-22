-- Mimari ailesi kontrollu listeye cevrildi (K158) + surec/transistor alanlari.
--
-- architecture_family text idi ve enum'a cevriliyor. Mevcut degerler
-- ("Blackwell", "RDNA 4" gibi) once slug haline getiriliyor; boylece
-- yeniden ice aktarma beklemeden veri korunuyor.

CREATE TYPE "ArchitectureFamily" AS ENUM (
  'blackwell', 'ada_lovelace', 'ampere',
  'rdna_4', 'rdna_3', 'rdna_2',
  'xe2', 'alchemist',
  'zen_5', 'zen_4',
  'arrow_lake', 'raptor_lake_refresh'
);

-- GPU: metni slug'a cevir, sonra tipi degistir.
UPDATE "gpu_specs" SET "architecture_family" = lower(replace("architecture_family", ' ', '_'))
  WHERE "architecture_family" IS NOT NULL;

ALTER TABLE "gpu_specs"
  ALTER COLUMN "architecture_family" TYPE "ArchitectureFamily"
  USING "architecture_family"::"ArchitectureFamily";

ALTER TABLE "gpu_specs"
  ADD COLUMN "process_node_nm" INTEGER,
  ADD COLUMN "transistor_count_m" INTEGER;

ALTER TABLE "cpu_specs"
  ADD COLUMN "architecture_family" "ArchitectureFamily",
  ADD COLUMN "process_node_nm" INTEGER;
