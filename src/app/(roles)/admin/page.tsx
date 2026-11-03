import { redirect } from "next/navigation";

/** ROLE_HOME của ADMIN trỏ tới /admin/dashboard; Prompt 7 dùng /admin/reports. */
export default function AdminIndexPage() {
  redirect("/admin/reports");
}
