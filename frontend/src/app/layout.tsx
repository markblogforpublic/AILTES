import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LangProvider } from "@/lib/i18n";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI English Speaking Evaluation",
  description: "Practice IELTS speaking with AI-powered evaluation and feedback",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased scroll-smooth">
      <body className={`${inter.className} flex min-h-full flex-col bg-gradient-to-br from-gray-50 via-white to-indigo-50/40 text-gray-900`}>
        <LangProvider>
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </LangProvider>
      </body>
    </html>
  );
}
