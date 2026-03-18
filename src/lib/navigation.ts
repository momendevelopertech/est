import type { Messages } from "@/lib/i18n";

import type { AppRole } from "./auth/types";

export type NavigationItem = {
  href: string;
  label: string;
  roles: AppRole[];
};

const allRoles: AppRole[] = [
  "super_admin",
  "coordinator",
  "data_entry",
  "senior",
  "viewer"
];

export function getNavigation(messages: Messages): NavigationItem[] {
  return [
    {
      href: "/dashboard",
      label: messages.nav.dashboard,
      roles: allRoles
    },
    {
      href: "/team",
      label: messages.nav.team,
      roles: allRoles
    },
    {
      href: "/proctors",
      label: messages.nav.proctors,
      roles: ["super_admin", "coordinator", "data_entry"]
    },
    {
      href: "/locations",
      label: messages.nav.locations,
      roles: ["super_admin", "coordinator", "data_entry"]
    },
    {
      href: "/settings",
      label: messages.nav.settings,
      roles: ["super_admin", "coordinator"]
    }
  ];
}
