import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ChevronsLeft,
	ChevronsRight,
	Disc3,
	Home,
	Library,
	ListMusic,
	LogOut,
	Moon,
	Music,
	Search,
	Settings,
	Sun,
	Tags,
	Users,
} from "lucide-react";
import { useEffect } from "react";

import { GlobalContextMenu } from "@/components/GlobalContextMenu";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Player } from "@/components/Player";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useGlobalKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAuth } from "@/lib/auth";
import {
	enableQueueSync,
	isQueueSyncEnabled,
	restoreQueue,
	usePlayer,
} from "@/lib/player";
import { useTheme } from "@/lib/theme";

interface AppLayoutProps {
	children: React.ReactNode;
}

const navItems = [
	{ to: "/app", icon: Home, label: "Home" },
	{ to: "/app/search", icon: Search, label: "Search" },
	{ to: "/app/albums", icon: Disc3, label: "Albums" },
	{ to: "/app/artists", icon: Users, label: "Artists" },
	{ to: "/app/playlists", icon: ListMusic, label: "Playlists" },
	{ to: "/app/genres", icon: Tags, label: "Genres" },
	{ to: "/app/songs", icon: Music, label: "Songs" },
	{ to: "/app/settings", icon: Settings, label: "Settings" },
];

function AppSidebar() {
	const { logout, credentials } = useAuth();
	const { theme, setTheme } = useTheme();
	const router = useRouterState();
	const navigate = useNavigate();
	const currentPath = router.location.pathname;
	const { setOpenMobile, isMobile, toggleSidebar, state } = useSidebar();

	// Close mobile menu on navigation
	// biome-ignore lint: currentPath is intentionally used to trigger menu close on navigation
	useEffect(() => {
		if (isMobile) {
			setOpenMobile(false);
		}
	}, [currentPath]);

	const toggleTheme = () => {
		if (theme === "dark") {
			setTheme("light");
		} else {
			setTheme("dark");
		}
	};

	const handleLogout = () => {
		logout();
		navigate({ to: "/" });
	};

	return (
		<Sidebar collapsible="icon" style={{ viewTransitionName: "sidebar" }}>
			<SidebarHeader className="border-b">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild tooltip="Subsonic">
							<Link to="/app">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
									<Library className="size-4" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Subsonic</span>
									<span className="truncate text-xs text-muted-foreground">
										{credentials?.serverUrl?.replace(/https?:\/\//, "")}
									</span>
								</div>
							</Link>
						</SidebarMenuButton>
						{/* Desktop collapse button */}
						<Button
							variant="ghost"
							size="icon"
							className="hidden md:flex size-7 absolute right-2 top-1/2 -translate-y-1/2 group-data-[collapsible=icon]:hidden"
							onClick={toggleSidebar}
							title="Collapse sidebar"
						>
							<ChevronsLeft className="size-4" />
						</Button>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => {
								const isActive =
									currentPath === item.to ||
									(item.to !== "/app" && currentPath.startsWith(item.to));
								return (
									<SidebarMenuItem key={item.to}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={item.label}
										>
											<Link to={item.to}>
												<item.icon />
												<span>{item.label}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-t h-20 justify-center">
				<SidebarMenu>
					{/* Expand button - only visible when collapsed */}
					{state === "collapsed" && !isMobile && (
						<SidebarMenuItem>
							<SidebarMenuButton
								onClick={toggleSidebar}
								tooltip="Expand sidebar"
							>
								<ChevronsRight />
								<span>Expand</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					)}
					<SidebarMenuItem>
						{/* User info section - using div instead of SidebarMenuButton to avoid nested buttons */}
						<div className="flex items-center gap-2 px-2 py-1.5 w-full">
							<div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
								<span className="text-xs font-medium text-muted-foreground">
									{credentials?.username?.charAt(0).toUpperCase()}
								</span>
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
								<span className="truncate font-medium">
									{credentials?.username}
								</span>
							</div>
							<div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									onClick={toggleTheme}
									title={theme === "dark" ? "Light mode" : "Dark mode"}
								>
									{theme === "dark" ? (
										<Sun className="size-4" />
									) : (
										<Moon className="size-4" />
									)}
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									onClick={handleLogout}
									title="Sign out"
								>
									<LogOut className="size-4" />
								</Button>
							</div>
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}

function AppContent({ children }: { children: React.ReactNode }) {
	const { currentTrack } = usePlayer();
	const hasPlayer = currentTrack !== null;

	// Global keyboard shortcuts for player controls
	useGlobalKeyboardShortcuts();

	// Enable queue sync and restore queue on mount
	useEffect(() => {
		if (!isQueueSyncEnabled()) {
			enableQueueSync();
			restoreQueue();
		}
	}, []);

	// Track click position for view transition origin
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			// Store click position as CSS custom properties
			document.documentElement.style.setProperty("--click-x", `${e.clientX}px`);
			document.documentElement.style.setProperty("--click-y", `${e.clientY}px`);
		};

		document.addEventListener("click", handleClick);
		return () => document.removeEventListener("click", handleClick);
	}, []);

	return (
		<SidebarInset className="h-svh flex flex-col">
			{/* Mobile header */}
			<header
				className="flex h-14 items-center gap-2 border-b px-4 md:hidden shrink-0"
				style={{ viewTransitionName: "mobile-header" }}
			>
				<SidebarTrigger />
				<div className="flex items-center gap-2">
					<div className="size-7 rounded-lg bg-primary flex items-center justify-center">
						<Library className="size-4 text-primary-foreground" />
					</div>
					<span className="font-semibold text-foreground">Subsonic</span>
				</div>
			</header>

			{/* Scrollable content */}
			<main
				className="flex-1 overflow-auto"
				style={{ viewTransitionName: "main-content" }}
			>
				{children}
			</main>

			{/* Player bar */}
			{hasPlayer && <Player />}
		</SidebarInset>
	);
}

export function AppLayout({ children }: AppLayoutProps) {
	return (
		<GlobalContextMenu>
			<SidebarProvider>
				<AppSidebar />
				<AppContent>{children}</AppContent>
				<GlobalSearch />
				<Toaster position="top-center" />
			</SidebarProvider>
		</GlobalContextMenu>
	);
}
