import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipwise — AI short-form clips",
  description: "Turn long videos you own into captioned short-form clips.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main className="min-h-screen lg:pl-64">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
