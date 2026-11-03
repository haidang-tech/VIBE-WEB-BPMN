import { redirect } from "next/navigation";

/**
 * Blueprint có route /medical/blood-status. Trạng thái hiến máu hiện được hiển
 * thị ngay trong panel chốt kết quả tại /medical/health-check.
 */
export default function MedicalBloodStatusPage() {
  redirect("/medical/health-check");
}
