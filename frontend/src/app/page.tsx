"use client";

import { useLang } from "@/lib/i18n";
import { ArrowRight, BarChart3, MessageSquare, Target, Star } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    titleKey: "home.feature1.title",
    descKey: "home.feature1.desc",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: BarChart3,
    titleKey: "home.feature2.title",
    descKey: "home.feature2.desc",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    icon: Target,
    titleKey: "home.feature3.title",
    descKey: "home.feature3.desc",
    gradient: "from-rose-500 to-pink-500",
  },
];

const STATS = [
  { value: "3", labelKey: "home.statParts", en: "IELTS Parts", zh: "雅思部分" },
  { value: "9", labelKey: "home.statScale", en: "Band Scale", zh: "评分等级" },
  { value: "3", labelKey: "home.statDims", en: "Dimensions", zh: "评估维度" },
  { value: "24/7", labelKey: "home.statAvail", en: "Availability", zh: "可用时间" },
];

export default function HomePage() {
  const { t, lang } = useLang();

  return (
    <div>
      {/* ---- Hero ---- */}
      <section className="gradient-hero relative overflow-hidden rounded-3xl px-6 py-20 text-center sm:px-12 sm:py-28">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-purple-200/30 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-10 h-40 w-40 rounded-full bg-pink-200/20 blur-2xl" />

        <div className="relative animate-fade-in-up">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200">
            <Star size={32} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            {t("home.hero.title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 leading-relaxed">
            {t("home.hero.subtitle")}
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/practice"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:shadow-xl hover:shadow-indigo-300 hover:scale-105 active:scale-[1.02]"
            >
              {t("home.hero.cta")}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.labelKey}
              className="rounded-xl border border-white/60 bg-white/50 p-4 text-center backdrop-blur-sm"
            >
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="mt-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {lang === "zh" ? s.zh : s.en}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="mt-20">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.titleKey}
                className="card-hover group rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} text-white shadow-md`}
                >
                  <f.icon size={22} />
                </div>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {t(f.titleKey)}
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {t(f.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA section ---- */}
      <section className="mt-20 mb-8">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8 text-center text-white shadow-xl sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">
            {t("home.hero.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-indigo-100">
            {t("home.hero.subtitle")}
          </p>
          <a
            href="/practice"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3 text-sm font-semibold text-indigo-700 shadow-lg transition-all hover:bg-indigo-50 hover:scale-105"
          >
            {t("home.hero.cta")}
            <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </div>
  );
}
