import "server-only";

import { redirect } from "next/navigation";

import type { AppRole } from "./types";
import { requireSession } from "./session";

export async function requireRole(allowedRoles: AppRole[]) {
  const session = await requireSession();

  if (!allowedRoles.includes(session.user.role)) {
    redirect("/dashboard");
  }

  return session;
}
