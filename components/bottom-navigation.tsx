"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, Package, UsersRound, User } from "lucide-react";
import { cn } from "@/lib/utils";

import { useLanguage } from "@/contexts/language-context";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

// ✅ مسارات يتم إخفاء الشريط فيها
const hiddenPaths = ["/dashboard/deposit", "/dashboard/withdraw"];

function normalize(path: string) {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isInAllowedSection(path: string) {
  const p = normalize(path);
  // ✅ لا يظهر في deposit أو withdraw
  if (hiddenPaths.some((hide) => p.startsWith(hide))) return false;
  // Note: We check roots dynamically inside the component now or keep a static list of roots if needed.
  // For simplicity, we can verify against the known routes:
  const allowedRoots = ["/dashboard", "/dashboard/trading", "/dashboard/packages", "/dashboard/referrals", "/dashboard/profile"];
  return allowedRoots.some((root) => p === root || p.startsWith(root + "/"));
}

function isActive(path: string, root: string) {
  const p = normalize(path);
  return p === root || p.startsWith(root + "/");
}

export default function BottomNavigation() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const show = isInAllowedSection(pathname);

  const items: Item[] = [
    { href: "/dashboard", label: t('nav.home'), icon: Home },
    { href: "/dashboard/trading", label: t('nav.trading'), icon: LineChart },
    { href: "/dashboard/packages", label: t('nav.packages'), icon: Package },
    { href: "/dashboard/referrals", label: t('nav.referrals'), icon: UsersRound },
    { href: "/dashboard/profile", label: t('nav.profile'), icon: User },
  ];

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
 
