import { Link, useRouterState } from "@tanstack/react-router";
import {
	Disc3,
	Home,
	Library,
	LogOut,
	Menu,
	Moon,
	Music,
	Search,
	Sun,
	Users,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Player } from "@/components/Player";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
	children: React.ReactNode;
}

const navItems = [
	{ to: "/app", icon: Home, label: "Home" },
	{ to: "/app/search", icon: Search, label: "Search" },
	{ to: "/app/albums", icon: Disc3, label: "Albums" },
	{ to: "/app/artists", icon: Users, label: "Artists" },
	{ to: "/app/songs", icon: Music, label: "Songs" },
];

export function AppLayout({ children }: AppLayoutProps) {
	const { logout, credentials } = useAuth();
	const { theme, setTheme } = useTheme();
	const { currentTrack } = usePlayer();
	const router = useRouterState();
	const currentPath = router.location.pathname;
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	// Close mobile menu on route change
	// biome-ignore lint/correctness/useExhaustiveDependencies: currentPath is intentionally used to trigger menu close on navigation
	useEffect(() => {
		setMobileMenuOpen(false);
	}, [currentPath]);

	const toggleTheme = () => {
		if (theme === "dark") {
			setTheme("light");
		} else {
			setTheme("dark");
		}
	};

	const hasPlayer = currentTrack !== null;

	const sidebarContent = (
		<>
			{/* Logo */}
			<div className="p-6 border-b">
				<Link to="/app" className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
						<Library className="w-5 h-5 text-primary-foreground" />
					</div>
					<div>
						<h1 className="font-semibold text-foreground">Subsonic</h1>
						<p className="text-xs text-muted-foreground truncate max-w-32">
							{credentials?.serverUrl?.replace(/https?:\/\//, "")}
						</p>
					</div>
				</Link>
			</div>

			{/* Navigation */}
			<nav className="flex-1 p-4 overflow-auto">
				<ul className="space-y-1">
					{navItems.map((item) => {
						const isActive =
							currentPath === item.to ||
							(item.to !== "/app" && currentPath.startsWith(item.to));
						return (
							<li key={item.to}>
								<Link
									to={item.to}
									className={cn(
										"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
										isActive
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:text-foreground hover:bg-muted",
									)}
								>
									<item.icon className="w-5 h-5" />
									{item.label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* User section */}
			<div className="p-4 border-t">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 min-w-0">
						<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
							<span className="text-xs font-medium text-muted-foreground">
								{credentials?.username?.charAt(0).toUpperCase()}
							</span>
						</div>
						<span className="text-sm font-medium truncate">
							{credentials?.username}
						</span>
					</div>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleTheme}
							title={theme === "dark" ? "Light mode" : "Dark mode"}
						>
							{theme === "dark" ? (
								<Sun className="w-4 h-4" />
							) : (
								<Moon className="w-4 h-4" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={logout}
							title="Sign out"
						>
							<LogOut className="w-4 h-4" />
						</Button>
					</div>
				</div>
			</div>
		</>
	);

	return (
		<div className="h-screen bg-background flex flex-col md:flex-row">
			{/* Mobile header */}
			<header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
				<Link to="/app" className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
						<Library className="w-4 h-4 text-primary-foreground" />
					</div>
					<span className="font-semibold text-foreground">Subsonic</span>
				</Link>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setMobileMenuOpen(true)}
					aria-label="Open menu"
				>
					<Menu className="w-5 h-5" />
				</Button>
			</header>

			{/* Mobile drawer overlay */}
			{mobileMenuOpen && (
				// biome-ignore lint/a11y/noStaticElementInteractions: Overlay used for click-to-dismiss pattern
				<div
					role="presentation"
					className="fixed inset-0 z-50 md:hidden"
					onClick={() => setMobileMenuOpen(false)}
				>
					{/* Backdrop */}
					<div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

					{/* Drawer */}
					<aside
						className="absolute left-0 top-0 h-full w-64 max-w-[80vw] bg-card border-r flex flex-col shadow-xl"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						{/* Close button */}
						<div className="absolute top-4 right-4">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setMobileMenuOpen(false)}
								aria-label="Close menu"
							>
								<X className="w-5 h-5" />
							</Button>
						</div>
						{sidebarContent}
					</aside>
				</div>
			)}

			{/* Desktop Sidebar */}
			<aside className="hidden md:flex w-64 border-r bg-card flex-col flex-shrink-0">
				{sidebarContent}
			</aside>

			{/* Main content area with player */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Scrollable content */}
				<main className="flex-1 overflow-auto">{children}</main>

				{/* Player bar - at bottom of main content */}
				{hasPlayer && <Player />}
			</div>
		</div>
	);
}
