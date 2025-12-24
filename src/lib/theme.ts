import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const THEME_KEY = "subsonic-theme";

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

function applyTheme(theme: Theme) {
	const root = document.documentElement;
	const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

	root.classList.remove("light", "dark");
	root.classList.add(effectiveTheme);
}

export function useTheme() {
	const [theme, setThemeState] = useState<Theme>(getStoredTheme);

	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	useEffect(() => {
		// Listen for system theme changes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			if (theme === "system") {
				applyTheme("system");
			}
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	const setTheme = (newTheme: Theme) => {
		localStorage.setItem(THEME_KEY, newTheme);
		setThemeState(newTheme);
	};

	return { theme, setTheme };
}
