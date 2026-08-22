-- Alan bazinda kaynak defteri (K170).
--
-- Satir basina provenance gercegi anlatmiyor: bir gpu_specs satirinin bant
-- genisligi Wikipedia'dan, geri kalani ureticiden gelebiliyor.
--
-- Bu migration uc sey yapiyor:
--   1. Source enum'una 'wikipedia' degerini ekliyor
--   2. spec_field_sources tablosunu kuruyor
--   3. BUGUN DOLU olan her spec alanini, satirinin damgasiyla geri dolduruyor
--
-- 3. adim onemli: gecisten sonra hicbir dolu alan damgasiz kalmiyor.
-- Bugun 'manufacturer' damgali her satirin her dolu alani 'manufacturer'
-- olarak yaziliyor -- damga degismiyor, yalnizca alan seviyesine iniyor.

ALTER TYPE "Source" ADD VALUE IF NOT EXISTS 'wikipedia';

CREATE TABLE "spec_field_sources" (
  "part_id"    TEXT NOT NULL,
  "field_name" TEXT NOT NULL,

  "source"       "Source" NOT NULL,
  "source_url"   TEXT,
  "confidence"   "Confidence" NOT NULL,
  "collected_at" TIMESTAMPTZ(6) NOT NULL,

  -- Yalnizca lisans yukumlulugu olan kaynakta dolu (Wikipedia, CC BY-SA).
  "license"            TEXT,
  "source_article"     TEXT,
  "source_revision_id" INTEGER,

  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "spec_field_sources_pkey" PRIMARY KEY ("part_id", "field_name")
);

CREATE INDEX "spec_field_sources_source_idx" ON "spec_field_sources"("source");

ALTER TABLE "spec_field_sources"
  ADD CONSTRAINT "spec_field_sources_part_id_fkey"
  FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Geri doldurma.
--
-- Sutun listesi ELLE YAZILMIYOR, information_schema'dan okunuyor: elle yazilan
-- liste eksik kalir ve eksikligi ancak birisi fark edince anlasilir. Disarida
-- birakilanlar defter sutunlarinin kendisi.
DO $$
DECLARE
  t TEXT;
  c TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gpu_specs', 'gpu_variant_specs', 'cpu_specs', 'motherboard_specs',
    'ram_specs', 'psu_specs', 'storage_specs', 'case_specs'
  ] LOOP
    FOR c IN
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name NOT IN (
          'part_id', 'source', 'source_url', 'confidence',
          'collected_at', 'created_at', 'updated_at'
        )
    LOOP
      EXECUTE format(
        'INSERT INTO spec_field_sources
           (part_id, field_name, source, source_url, confidence, collected_at, updated_at)
         SELECT part_id, %L, source, source_url, confidence, collected_at, CURRENT_TIMESTAMP
         FROM %I WHERE %I IS NOT NULL
         ON CONFLICT (part_id, field_name) DO NOTHING',
        c, t, c
      );
    END LOOP;
  END LOOP;
END $$;
