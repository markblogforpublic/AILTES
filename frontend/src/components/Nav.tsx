"use client";

import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { GraduationCap, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", labelKey: "nav.home" },
  { href: "/practice", labelKey: "nav.practice" },
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/history", labelKey: "nav.history" },
  { href: "/settings", labelKey: "nav.settings" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const { t, lang, toggle } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
            <GraduationCap size={20} />
          </div>
          <span className="gradient-text hidden sm:inline">AI Speaking</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ href, labelKey }) => {
            const isActive = pathname === href;
            return (
              <a
                key={href}
                href={href}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "text-indigo-700"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                {t(labelKey)}
                {isActive && (
                  <span className="absolute inset-x-2 -bottom-[11px] h-0.5 rounded-full bg-indigo-500" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {lang === "en" ? "中文" : "EN"}
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, labelKey }) => {
              const isActive = pathname === href;
              return (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  }`}
                >
                  {t(labelKey)}
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
