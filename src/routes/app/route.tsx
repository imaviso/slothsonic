import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppLayout } from "@/components/AppLayout";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/app")({
	beforeLoad: () => {
		if (!isAuthenticated()) {
			throw redirect({ to: "/" });
		}
	},
	component: AppLayoutRoute,
});

function AppLayoutRoute() {
	return (
		<AppLayout>
			<Outlet />
		</AppLayout>
	);
}
