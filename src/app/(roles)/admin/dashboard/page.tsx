import { redirect } from "next/navigation";

/** Dashboard mặc định của Admin hiện là trang báo cáo (Prompt 7). */
export default function AdminDashboardPage() {
  redirect("/admin/reports");
}
