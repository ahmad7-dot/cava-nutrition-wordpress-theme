"use client";
import {
  Clapperboard, CreditCard, Download, FolderClock, LayoutDashboard, Menu, Palette, PlusCircle, Settings2, Sparkles, User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "New Project", icon: PlusCircle },
  { href: "/history", label: "Projects", icon: FolderClock },
  { href: "/clips", label: "Generated Clips", icon: Clapperboard },
  { href: "/exports", label: "Export Center", icon: Download },
  { divider: "Settings" },
  { href: "/settings/brand", label: "Brand", icon: Palette },
  { href: "/settings/ai", label: "AI Settings", icon: Settings2 },
  { href: "/billing", label: "Subscription & Usage", icon: CreditCard },
  { href: "/account", label: "Account", icon: User },
] as const;

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button className="btn-ghost px-3 py-1.5" onClick={() => setOpen(!open)} aria-label="Menu">
          <Menu className="h-4 w-4" />
        </button>
      </div>
      <aside className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 border-r border-ink-700 bg-ink-900 lg:block`}>
        <div className="flex h-full flex-col px-3 py-5">
          <div className="mb-6 hidden px-2 lg:block"><Brand /></div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto">
            {NAV.map((item, i) =>
              "divider" in item ? (
                <div key={i} className="px-3 pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-haze-500">{item.divider}</div>
              ) : (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active(item.href) ? "bg-accent-soft text-haze-100" : "text-haze-400 hover:bg-ink-800 hover:text-haze-100"}`}>
                  <item.icon className={`h-4 w-4 ${active(item.href) ? "text-accent-strong" : ""}`} />
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="mt-4 rounded-xl border border-ink-700 bg-ink-850 p-3 text-xs text-haze-400">
            Only process videos you own or are authorised to use. Scores are estimates, not guarantees.
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-mint">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Clipwise</span>
    </Link>
  );
}
