-- CreateTable
CREATE TABLE "gpu_variant_specs" (
    "part_id" TEXT NOT NULL,
    "chip_part_id" TEXT NOT NULL,
    "length_mm" INTEGER,
    "height_mm" INTEGER,
    "thickness_slots" DOUBLE PRECISION,
    "tbp_watt" INTEGER,
    "recommended_psu_watt" INTEGER,
    "power_connectors" TEXT,
    "boost_clock_mhz" INTEGER,
    "boost_clock_oc_mhz" INTEGER,
    "fan_count" INTEGER,
    "hdmi_count" INTEGER,
    "displayport_count" INTEGER,
    "usb_c_count" INTEGER,
    "source" "Source" NOT NULL,
    "source_url" TEXT,
    "confidence" "Confidence" NOT NULL,
    "collected_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gpu_variant_specs_pkey" PRIMARY KEY ("part_id")
);

-- CreateIndex
CREATE INDEX "gpu_variant_specs_chip_part_id_idx" ON "gpu_variant_specs"("chip_part_id");

-- AddForeignKey
ALTER TABLE "gpu_variant_specs" ADD CONSTRAINT "gpu_variant_specs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpu_variant_specs" ADD CONSTRAINT "gpu_variant_specs_chip_part_id_fkey" FOREIGN KEY ("chip_part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
