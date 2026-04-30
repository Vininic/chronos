import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useT } from "@/lib/i18n/I18nProvider";

export default function DashboardLayout() {
  const t = useT();
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 chronos-surface">
          <div className="p-6 lg:p-8">
            <Outlet />
          </div>
          <footer className="py-8 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {t.chronos.layoutFooter}
          </footer>
        </main>
      </div>
    </div>
  );
}