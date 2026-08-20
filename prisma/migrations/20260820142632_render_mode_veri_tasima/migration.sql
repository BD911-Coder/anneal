-- Veri tasima: render modu upscaling alanindan kendi alanina gecer (K111).
--
-- Bir sure raytracing bilgisi `upscaling` alanina "DLSS/FSR Native + Raytracing"
-- biciminde yaziliyordu (K108). Bu, alani sorgulanamaz hale getiriyordu.
-- Dort oyunun 32 satiri burada tasiniyor; olculen FPS degeri DEGISMIYOR.
--
-- Neden migration icinde: `benchmark_points` append-only ve uygulama kodundan
-- UPDATE yazilmaz. Append-only'nin amaci bir olcumun sessizce revize
-- edilmemesi; burada olcum degil, ayarin KAYDEDILME BICIMI duzeliyor ve
-- degisiklik migration gecmisinde kayitli kaliyor.

UPDATE "benchmark_points"
SET "render_mode" = 'raytracing',
    "upscaling"   = regexp_replace("upscaling", ' \+ Raytracing$', '')
WHERE "upscaling" LIKE '% + Raytracing';
