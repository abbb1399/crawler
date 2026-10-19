-- CreateEnum
CREATE TYPE "Region" AS ENUM ('SEOUL', 'GYEONGGI', 'INCHEON');

-- AlterTable
ALTER TABLE "SearchProfile" ADD COLUMN     "regions" "Region"[] DEFAULT ARRAY[]::"Region"[];
