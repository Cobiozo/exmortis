import React from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useViewer } from "@/lib/useViewer";
import { useAnnDot } from "./useAnnDot";
import { base44 } from "@/api/base44Client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const cls = "flex items-center gap-2 p-2 gold-text hover:text-[#E2C170] whitespace-nowrap transition-colors";
const label = "technical text-[11px] !tracking-[0.12em] xl:!tracking-[0.18em] hidden xl:inline";

// Ikona konta; napis tylko od 1280 px. Admin ma „Panel” w rozwijanym menu.
export default function AccountMenu() {
  const { user } = useViewer();
  const dot = useAnnDot(user);
  if (!user) {
    return <Link to="/login" className={cls} title="Zaloguj" aria-label="Zaloguj"><UserRound className="h-5 w-5" strokeWidth={1.25} /><span className={label}>Zaloguj</span></Link>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cls} title="Moje konto" aria-label={dot ? "Moje konto — nowe ogłoszenie" : "Moje konto"}>
        <span className="relative"><UserRound className="h-5 w-5" strokeWidth={1.25} />
          {dot && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#C9A24A]" aria-hidden="true" />}</span><span className={label}>Moje konto</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#0A0A0B] border-[#3D3D3F] rounded-none">
        <DropdownMenuItem asChild><Link to="/konto" className="technical text-[10px]">Moje konto</Link></DropdownMenuItem>
        {user.role === "admin" && <DropdownMenuItem asChild><Link to="/admin" className="technical text-[10px]">Panel</Link></DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => base44.auth.logout("/")} className="technical text-[10px]">Wyloguj</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}