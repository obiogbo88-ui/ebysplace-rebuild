import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getAdminLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { navigateWithSmoothScroll, smoothScrollToElement } from "@/lib/smoothScroll";
import { trpc } from "@/lib/trpc";
import { Activity, CalendarDays, Home, Images, Instagram, LayoutDashboard, LogOut, MessageSquare, Package, PanelLeft, Scissors, ShoppingBag, Users } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/admin" },
  { icon: CalendarDays, label: "Bookings", path: "/admin#bookings" },
  { icon: CalendarDays, label: "Availability", path: "/admin#availability" },
  { icon: ShoppingBag, label: "Orders", path: "/admin#orders" },
  { icon: Package, label: "Products", path: "/admin#products" },
  { icon: Scissors, label: "Services", path: "/admin#services" },
  { icon: Images, label: "Gallery", path: "/admin#gallery" },
  { icon: Instagram, label: "Instagram", path: "/admin#instagram" },
  { icon: MessageSquare, label: "Reviews", path: "/admin#reviews" },
  { icon: Activity, label: "Activity & Notifications", path: "/admin#activity-monitoring" },
  { icon: Users, label: "Admin Users", path: "/admin#users" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fffaf0] px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-[#d8b66b]/40 bg-white p-8 text-center shadow-[0_18px_45px_rgba(93,67,32,0.12)]">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-[#2f2418]">
              Sign in to continue
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-[#5f5142]">
              Access to this dashboard requires the Eby’s Place Supabase admin email and password.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getAdminLoginUrl("/admin");
            }}
            size="lg"
            className="w-full shadow-lg transition-all hover:shadow-xl"
          >
            Sign in with email
          </Button>
          <Button type="button" variant="outline" onClick={() => navigateWithSmoothScroll("/")} className="w-full border-[#d8b66b]/50 bg-white text-[#2f2418] hover:bg-[#fff7df]">
            Back to website
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const unreadActivityCount = trpc.admin.unreadActivityCount.useQuery(undefined, {
    enabled: Boolean(user?.role === "admin"),
    retry: false,
    refetchInterval: 15000,
  });
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [currentHash, setCurrentHash] = useState(() => (typeof window === "undefined" ? "" : window.location.hash));
  const activePath = location === "/admin" && currentHash ? `/admin${currentHash}` : location;
  const activeMenuItem = menuItems.find(item => item.path === activePath) ?? menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const returnToHomepage = () => {
    navigateWithSmoothScroll("/", setLocation);
  };

  const handleSignOut = async () => {
    await logout();
    returnToHomepage();
  };

  const navigateAdminMenu = (path: string) => {
    const [pathname, sectionId] = path.split("#");
    setLocation(path);
    if (pathname === "/admin" && sectionId) {
      smoothScrollToElement(sectionId, 60);
      setCurrentHash(`#${sectionId}`);
      return;
    }
    setCurrentHash("");
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Eby’s Place Admin
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = activePath === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigateAdminMenu(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                      {item.path === "/admin#activity-monitoring" && (unreadActivityCount.data ?? 0) > 0 ? (
                        <span className="ml-auto rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary group-data-[collapsible=icon]:hidden">
                          {unreadActivityCount.data}
                        </span>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <Button
              type="button"
              variant="outline"
              onClick={returnToHomepage}
              className="mb-3 h-10 w-full justify-start gap-2 border-primary/30 bg-background/80 text-foreground hover:bg-primary/10 group-data-[collapsible=icon]:justify-center"
              aria-label="Back to website homepage"
            >
              <Home className="h-4 w-4 text-primary" />
              <span className="group-data-[collapsible=icon]:hidden">Back to Website</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
