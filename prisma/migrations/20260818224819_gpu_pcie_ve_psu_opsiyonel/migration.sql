-- AlterTable
ALTER TABLE "gpu_specs" ALTER COLUMN "recommended_psu_watt" DROP NOT NULL,
ALTER COLUMN "pcie_version" DROP NOT NULL;
