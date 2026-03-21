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
      href: "/cycles",
      label: messages.nav.cycles,
      roles: ["super_admin", "coordinator", "data_entry"]
    },
    {
      href: "/sessions",
      label: messages.nav.sessions,
      roles: ["super_admin", "coordinator", "data_entry"]
    },
    {
      href: "/reports",
      label: messages.nav.reports,
      roles: allRoles
    },
    {
      href: "/notifications",
      label: messages.nav.notifications,
      roles: allRoles
    },
    {
      href: "/test",
      label: messages.nav.testGuide,
      roles: ["super_admin", "coordinator"]
    },
    {
      href: "/settings",
      label: messages.nav.settings,
      roles: ["super_admin", "coordinator"]
    }
  ];
}
