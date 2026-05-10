import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 chronos-surface overflow-y-auto">
          <div className="p-6 lg:p-8">
            <Outlet />
          </div>
          <footer className="py-8 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Chronos · by Vinicius
          </footer>
        </main>
      </div>
    </div>
  );
}