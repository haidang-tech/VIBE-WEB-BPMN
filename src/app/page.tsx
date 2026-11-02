import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  redirect(session ? ROLE_HOME[session.role] : "/login");
}
