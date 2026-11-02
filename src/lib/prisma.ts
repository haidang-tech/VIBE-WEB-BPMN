import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton: tránh tạo quá nhiều connection trong chế độ dev
 * (Next.js hot-reload xóa module cache liên tục).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
