import React from "react";
import { Link, useLocation } from "react-router-dom";
import { UserRound, LayoutDashboard, LogOut } from "lucide-react";
import { useViewer } from "@/lib/useViewer";
import { base44 } from "@/api/base44Client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Konto w belce (19.11.2026): wyróżnione złotą ramką — jedyny wyróżniony element belki („Zrób test” to zwykła pozycja).
// Napis od 1280 px, niżej sama ikona w tej samej ramce. Rozwijane menu w stylu systemu: Inter, zdania, zaokrąglenia,
// podświetlenie jak w menu głównym. Admin ma dodatkowo „Panel”.
const btn = "inline-flex items-center justify-center gap-2 min-h-10 min-w-10 px-2.5 xl:px-3.5 rounded-lg border border-[#C9A24A]/55 gold-text text-[14px] font-medium whitespace-nowrap transition-colors hover:border-[#C9A24A] hover:text-[#E2C170] hover:bg-[#C9A24A]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A] data-[state=open]:bg-[#C9A24A]/10 data-[state=open]:border-[#C9A24A]";
const label = "hidden xl:inline";
const item = "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 min-h-10 text-[14px] text-[#F5EFE1]/85 outline-none transition-colors focus:bg-white/[0.06] focus:text-[#F5EFE1] data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-[#F5EFE1]";
const icon = "h-4 w-4 shrink-0 text-[#C9A24A]";

export default function AccountMenu() {
  const { user } = useViewer();
  const { pathname } = useLocation();
  if (!user) {
    return (
      <Link to="/login" className={btn} aria-label="Zaloguj się" aria-current={pathname === "/login" ? "page" : undefined}>
        <UserRound className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" /><span className={label}>Zaloguj się</span>
      </Link>
    );
  }
  const name = String(user.full_name || "").trim().split(/\s+/)[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={btn} aria-label="Moje konto">
        <UserRound className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" /><span className={label}>Moje konto</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}
        className="min-w-[220px] rounded-xl border border-[#2A2A2C] bg-[#0F0F11] p-1.5 text-[#F5EFE1] shadow-[0_16px_40px_rgba(0,0,0,.55)]">
        {(name || user.email) && (
          <div className="px-3 pb-2 pt-1.5">
            {name && <p className="text-[14px] font-medium text-[#F5EFE1]">{name}</p>}
            {user.email && <p className="truncate text-[12px] text-[#A3A3A6]">{user.email}</p>}
          </div>
        )}
        <DropdownMenuItem asChild className={item}>
          <Link to="/konto"><UserRound className={icon} strokeWidth={1.5} aria-hidden="true" />Moje konto</Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem asChild className={item}>
            <Link to="/admin"><LayoutDashboard className={icon} strokeWidth={1.5} aria-hidden="true" />Panel</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="my-1 bg-[#2A2A2C]" />
        <DropdownMenuItem onSelect={() => base44.auth.logout("/")} className={item}>
          <LogOut className={icon} strokeWidth={1.5} aria-hidden="true" />Wyloguj się
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
