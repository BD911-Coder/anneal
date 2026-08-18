-- Kayit cozunurlugu ve indekssiz sistem — SCHEMA.md v1.3,
-- docs/KARARLAR.md K43 ve K44.
--
-- Iki degisiklik:
--   1. builds.resolution eklendi — dondurulan indeks artik kullanicinin
--      kaydettigi cozunurlukte hesaplaniyor. Cozunurluk yazilmasaydi
--      dondurulan sayi neyi ifade ettigi bilinmeyen bir sayi olurdu.
--   2. builds.perf_index_snapshot artik null olabilir — ekran kartsiz (iGPU)
--      sistemin indeksi hesaplanamiyor, ama sistem gecerli ve kaydedilebilmeli.
--
-- Bu migration elle yazildi: mevcut kayitlar varsayilani olmayan zorunlu bir
-- sutunu kabul etmez. Sutun gecici bir varsayilanla eklenip varsayilan hemen
-- dusuruluyor — semada varsayilan kalmiyor.

-- AlterTable: builds.resolution
-- Mevcut kayitlar 1440p referansiyla hesaplanmisti (eski K38), yani '1440p'
-- uydurma bir etiket degil, o satirlarin gercegi.
ALTER TABLE "builds" ADD COLUMN "resolution" "Resolution" NOT NULL DEFAULT '1440p';
ALTER TABLE "builds" ALTER COLUMN "resolution" DROP DEFAULT;

-- AlterTable: builds.perf_index_snapshot zorunlu olmaktan cikiyor.
-- Mevcut satirlarin degeri var, hicbiri null olmuyor — kisit gevsiyor, veri
-- degismiyor.
ALTER TABLE "builds" ALTER COLUMN "perf_index_snapshot" DROP NOT NULL;
