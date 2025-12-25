import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Music, Server, User } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { login as authLogin, isAuthenticated } from "@/lib/auth";
import { ping } from "@/lib/subsonic";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		if (isAuthenticated()) {
			throw redirect({ to: "/app" });
		}
	},
	component: LoginPage,
});

const loginSchema = v.object({
	serverUrl: v.pipe(
		v.string(),
		v.nonEmpty("Server URL is required"),
		v.url("Please enter a valid URL"),
	),
	username: v.pipe(v.string(), v.nonEmpty("Username is required")),
	password: v.pipe(v.string(), v.nonEmpty("Password is required")),
});

function LoginPage() {
	const navigate = useNavigate();
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			serverUrl: "",
			username: "",
			password: "",
		},
		validators: {
			onSubmit: loginSchema,
		},
		onSubmit: async ({ value }) => {
			setServerError(null);

			const credentials = {
				serverUrl: value.serverUrl.trim(),
				username: value.username.trim(),
				password: value.password,
			};

			const result = await ping(credentials);

			if (result.success) {
				authLogin(credentials);
				navigate({ to: "/app" });
			} else {
				setServerError(result.error || "Failed to connect to server");
			}
		},
	});

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-md">
				{/* Logo/Header */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
						<Music className="w-8 h-8 text-foreground" />
					</div>
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Subsonic Client
					</h1>
					<p className="text-muted-foreground">Connect to your music server</p>
				</div>

				{/* Login Card */}
				<Card>
					<CardHeader>
						<CardTitle>Sign In</CardTitle>
						<CardDescription>
							Enter your Subsonic server credentials
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
							className="space-y-4"
						>
							{/* Server URL */}
							<form.Field name="serverUrl">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor={field.name}>Server URL</FieldLabel>
										<div className="relative">
											<Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
											<Input
												id={field.name}
												type="url"
												placeholder="https://your-server.com"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												className="pl-10"
											/>
										</div>
										{field.state.meta.errors.length > 0 && (
											<FieldError
												errors={field.state.meta.errors.map((err) => ({
													message: typeof err === "string" ? err : err?.message,
												}))}
											/>
										)}
									</Field>
								)}
							</form.Field>

							{/* Username */}
							<form.Field name="username">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor={field.name}>Username</FieldLabel>
										<div className="relative">
											<User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
											<Input
												id={field.name}
												type="text"
												placeholder="Enter your username"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												className="pl-10"
											/>
										</div>
										{field.state.meta.errors.length > 0 && (
											<FieldError
												errors={field.state.meta.errors.map((err) => ({
													message: typeof err === "string" ? err : err?.message,
												}))}
											/>
										)}
									</Field>
								)}
							</form.Field>

							{/* Password */}
							<form.Field name="password">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor={field.name}>Password</FieldLabel>
										<div className="relative">
											<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
											<Input
												id={field.name}
												type="password"
												placeholder="Enter your password"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												className="pl-10"
											/>
										</div>
										{field.state.meta.errors.length > 0 && (
											<FieldError
												errors={field.state.meta.errors.map((err) => ({
													message: typeof err === "string" ? err : err?.message,
												}))}
											/>
										)}
									</Field>
								)}
							</form.Field>

							{/* Server Error Message */}
							{serverError && (
								<div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
									{serverError}
								</div>
							)}

							{/* Submit Button */}
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button
										type="submit"
										className="w-full"
										disabled={isSubmitting}
									>
										{isSubmitting ? (
											<>
												<Loader2 className="w-4 h-4 animate-spin" />
												Connecting...
											</>
										) : (
											"Connect"
										)}
									</Button>
								)}
							</form.Subscribe>
						</form>
					</CardContent>
				</Card>

				{/* Footer */}
				<p className="text-center text-muted-foreground text-sm mt-6">
					Compatible with Subsonic, Navidrome, Airsonic, and other Subsonic API
					servers
				</p>
			</div>
		</div>
	);
}
