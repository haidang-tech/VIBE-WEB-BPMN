/**
 * RBAC dùng chung cho middleware (Edge runtime) và server.
 * File này KHÔNG được import Prisma / node:crypto để giữ tương thích Edge.
 */

export const ROLES = ["STUDENT", "ORGANIZER", "MEDICAL", "ADMIN"] as const;

export type UserRole = (typeof ROLES)[number];

/** Trang mặc định của từng role sau khi đăng nhập */
export const ROLE_HOME: Record<UserRole, string> = {
  STUDENT: "/student/register",
  ORGANIZER: "/organizer/dashboard",
  MEDICAL: "/medical/scan-id",
  ADMIN: "/admin/dashboard",
};

/** Tiền tố route được phép của từng role */
export const ROLE_PREFIX: Record<UserRole, string> = {
  STUDENT: "/student",
  ORGANIZER: "/organizer",
  MEDICAL: "/medical",
  ADMIN: "/admin",
};

/** Các route công khai, không cần JWT */
export const PUBLIC_PATHS = [
  // Trang giới thiệu dành cho khách; người đã đăng nhập vẫn xem được và có
  // liên kết quay lại bảng điều khiển của mình.
  "/",
  "/login",
  "/register",
  "/403",
  "/api/auth/login",
  "/api/auth/register",
  "/api/internal/audit",
] as const;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Trả về role sở hữu pathname (theo tiền tố), hoặc null nếu route dùng chung. */
export function roleForPath(pathname: string): UserRole | null {
  for (const role of ROLES) {
    const prefix = ROLE_PREFIX[role];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return role;
    }
  }

  return null;
}

/** Role có được phép truy cập pathname không? */
export function canAccessPath(role: UserRole, pathname: string): boolean {
  const required = roleForPath(pathname);
  return required === null || required === role;
}
