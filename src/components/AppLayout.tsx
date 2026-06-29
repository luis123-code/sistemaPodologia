import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider
      style={
        {
          
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-[100dvh] min-h-screen w-full min-w-0">
        <a
          href="#contenido-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Saltar al contenido principal
        </a>
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader />
          <main
            id="contenido-principal"
            tabIndex={-1}
            className="scrollbar-brand flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:px-4 sm:py-5 lg:px-6 lg:py-6"
          >
            <div className="mx-auto w-full max-w-[100vw] min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
