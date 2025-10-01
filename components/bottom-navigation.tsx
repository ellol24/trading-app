"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, Package, UsersRound, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const items: Item[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/trading", label: "Trading", icon: LineChart },
  { href: "/dashboard/packages", label: "Packages", icon: Package },
  { href: "/dashboard/referrals", label: "Referrals", icon: UsersRound },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

// السماح فقط بصفحات الداشبورد وما تحتها
const roots = items.map((i) => i.href);

function normalize(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isInAllowedSection(path: string) {
  const p = normalize(path);
  return roots.some((root) => p === root || p.startsWith(root + "/"));
}

function isActive(path: string, root: string) {
  const p = normalize(path);
  return p === root || p.startsWith(root + "/");
}

export default function BottomNavigation() {
  const pathname = usePathname();
  const show = isInAllowedSection(pathname);

  if (!show) return null;

  return (
    <nav
      aria-label="Primary bottom navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 border-t",
        "bg-white/85 dark:bg-gray-900/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-900/70"
      )}
    >
      <ul className="mx-auto grid max-w-screen-sm grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-2 text-xs transition-colors",
                  active
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "mb-1 h-5 w-5",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <span className="select-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
