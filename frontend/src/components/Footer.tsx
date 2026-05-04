"use client";

import { useLang } from "@/lib/i18n";
import { GraduationCap } from "lucide-react";

export function Footer() {
  const { t } = useLang();

  return (
    <footer className="mt-auto border-t border-gray-200/60 bg-white/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 sm:px-6 lg:px-8 lg:flex-row lg:justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <GraduationCap size={14} />
          </div>
          <span className="font-semibold text-gray-700">AI Speaking</span>
        </div>

        {/* Tagline */}
        <p className="text-center text-sm text-gray-400 lg:text-left">
          {t("footer.tagline")}
        </p>

        {/* Copyright */}
        <p className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} AI Speaking BY{" "}
          <a
            href="https://markblogforpublic.github.io/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
          >
            Mark
          </a>
          . {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
