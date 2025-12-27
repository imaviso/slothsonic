import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const THEME_KEY = "slothsonic-theme";

function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function getStoredTheme(): Theme {
	if (typeof window === "undefined") return "system";
	return (localStorage.getItem(THEME_KEY) as Theme) || "system";
}

function applyThemeClass(theme: Theme) {
	const root = document.documentElement;
	const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

	root.classList.remove("light", "dark");
	root.classList.add(effectiveTheme);
}

function applyThemeWithTransition(theme: Theme) {
	// Get click position from CSS custom properties (set by AppLayout click handler)
	const x = getComputedStyle(document.documentElement)
		.getPropertyValue("--click-x")
		.trim();
	const y = getComputedStyle(document.documentElement)
		.getPropertyValue("--click-y")
		.trim();

	// Calculate the maximum radius needed to cover the entire screen
	const clickX = Number.parseInt(x, 10) || window.innerWidth / 2;
	const clickY = Number.parseInt(y, 10) || window.innerHeight / 2;
	const maxRadius = Math.hypot(
		Math.max(clickX, window.innerWidth - clickX),
		Math.max(clickY, window.innerHeight - clickY),
	);

	// Check if View Transitions API is supported
	if (!document.startViewTransition) {
		applyThemeClass(theme);
		return;
	}

	// Mark that we're doing a theme transition
	document.documentElement.dataset.themeTransition = "true";

	// Temporarily remove viewTransitionName from sidebar/player so they're included in root transition
	const sidebar = document.querySelector<HTMLElement>(
		'[style*="view-transition-name: sidebar"]',
	);
	const player = document.querySelector<HTMLElement>(
		'[style*="view-transition-name: player"]',
	);
	const mobileHeader = document.querySelector<HTMLElement>(
		'[style*="view-transition-name: mobile-header"]',
	);
	const mainContent = document.querySelector<HTMLElement>(
		'[style*="view-transition-name: main-content"]',
	);

	// Store original values and clear them
	const originals = [
		{ el: sidebar, name: "sidebar" },
		{ el: player, name: "player" },
		{ el: mobileHeader, name: "mobile-header" },
		{ el: mainContent, name: "main-content" },
	];

	for (const { el } of originals) {
		if (el) el.style.viewTransitionName = "none";
	}

	const transition = document.startViewTransition(() => {
		applyThemeClass(theme);
	});

	transition.ready.then(() => {
		// Animate the circle expanding from click position
		document.documentElement.animate(
			{
				clipPath: [
					`circle(0px at ${clickX}px ${clickY}px)`,
					`circle(${maxRadius}px at ${clickX}px ${clickY}px)`,
				],
			},
			{
				duration: 400,
				easing: "ease-out",
				pseudoElement: "::view-transition-new(root)",
			},
		);
	});

	transition.finished.then(() => {
		// Restore viewTransitionName values
		for (const { el, name } of originals) {
			if (el) el.style.viewTransitionName = name;
		}
		delete document.documentElement.dataset.themeTransition;
	});
}

export function useTheme() {
	const [theme, setThemeState] = useState<Theme>(getStoredTheme);

	// Apply theme on initial mount (no transition)
	// biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount
	useEffect(() => {
		applyThemeClass(theme);
	}, []);

	useEffect(() => {
		// Listen for system theme changes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			if (theme === "system") {
				applyThemeClass("system");
			}
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	const setTheme = (newTheme: Theme) => {
		localStorage.setItem(THEME_KEY, newTheme);
		applyThemeWithTransition(newTheme);
		setThemeState(newTheme);
	};

	return { theme, setTheme };
}
