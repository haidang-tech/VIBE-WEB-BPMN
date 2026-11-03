import { redirect } from "next/navigation";

/**
 * Blueprint có route /medical/scan-id. Prompt 6 gộp việc chọn hồ sơ vào hàng
 * chờ tại /medical/health-check nên route này chuyển hướng để tránh 404.
 */
export default function MedicalScanIdPage() {
  redirect("/medical/health-check");
}
