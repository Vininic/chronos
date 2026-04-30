import { Search, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Topbar() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <header className="h-16 border-b bg-card/70 backdrop-blur flex items-center px-6 gap-4 sticky top-0 z-10">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Today</div>
        <div className="font-display text-lg text-primary -mt-0.5">{today}</div>
      </div>
      <div className="flex-1 max-w-md ml-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Summon a ritual, block, or insight…"
            className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="h-10 w-10 rounded-md border border-border bg-background grid place-items-center hover:bg-secondary/10 relative">
          <Bell className="h-4 w-4 text-primary" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-secondary" />
        </button>
        <Button className="h-10 bg-primary text-primary-foreground hover:bg-primary-deep">
          <Plus className="h-4 w-4 mr-1" /> Compose block
        </Button>
      </div>
    </header>
  );
}
