import Link from "next/link";
import {
  Calendar,
  Clock,
  Image,
  MessageSquare,
  Star,
  Users
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/schedule", label: "Schedule", icon: Clock },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/stories", label: "Stories", icon: Image },
  { href: "/highlights", label: "Highlights", icon: Star },
  { href: "/dms", label: "DMs", icon: MessageSquare }
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 w-[240px] border-r bg-background">
      <div className="flex h-full flex-col px-4 py-6">
        <div className="mb-8 text-lg font-semibold">Lynkbase</div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                  "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span>Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
