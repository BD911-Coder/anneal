-- process_node_nm KALDIRILDI (K167).
--
-- Alan 20260822070000_mimari_ailesi_enum ile indeks tahmini ekseni olmak uzere
-- eklenmisti. Olculdu: uc ureticinin hicbiri yayinlamiyor (0/60 GPU, 0/42 CPU)
-- ve Wikipedia tablolarinda da sifir gecis var (K165 kuru calismasi:
-- "fabrikasyon sureci 0/82"). Doldurulacak bir kaynak yok.
--
-- Ileriye dogru dusuruluyor, eski migration DUZENLENMIYOR: uygulanmis bir
-- migration'in icerigini degistirmek checksum'i bozar ve gelistirme
-- veritabaninin sifirlanmasini gerektirir. Tarih oldugu gibi kalir, sutun
-- gider.
--
-- Veri kaybi yok: dusurulen iki sutunda tek bir dolu deger yok (olculdu).
ALTER TABLE "gpu_specs" DROP COLUMN "process_node_nm";
ALTER TABLE "cpu_specs" DROP COLUMN "process_node_nm";
