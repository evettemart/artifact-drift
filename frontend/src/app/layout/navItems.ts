import {
  LayoutDashboard,
  Network,
  GitCompareArrows,
  Plug,
  FileText,
  Bot,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Graph", path: "/graph", icon: Network },
  { label: "Drift", path: "/drift", icon: GitCompareArrows },
  { label: "Integrations", path: "/integrations", icon: Plug },
  { label: "Reports", path: "/reports", icon: FileText },
  { label: "Copilot", path: "/copilot", icon: Bot },
];
