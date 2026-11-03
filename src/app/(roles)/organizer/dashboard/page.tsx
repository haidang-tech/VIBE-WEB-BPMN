import { redirect } from "next/navigation";

/**
 * ROLE_HOME của ORGANIZER (src/lib/rbac.ts) trỏ tới /organizer/dashboard.
 * Prompt 5 tập trung vào màn hình check-in nên dashboard chuyển thẳng tới đó.
 */
export default function OrganizerDashboardPage() {
  redirect("/organizer/check-in");
}
