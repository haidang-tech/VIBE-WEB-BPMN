import { redirect } from "next/navigation";

/** ROLE_HOME của MEDICAL trỏ tới /medical/scan-id; Prompt 6 dùng chung /health-check. */
export default function MedicalIndexPage() {
  redirect("/medical/health-check");
}
