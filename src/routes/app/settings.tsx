import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { getCurrentBackendType, switchAudioBackend } from "@/lib/player";
import {
	type AudioBackend,
	checkMpvInstalled,
	useSettings,
} from "@/lib/settings";

export const Route = createFileRoute("/app/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const {
		settings,
		setAudioBackend,
		setMpvPath,
		setDynamicPlayerBackground,
		isElectron,
		isMpvAvailable,
	} = useSettings();
	const [mpvInstalled, setMpvInstalled] = useState<boolean | null>(null);
	const [mpvPathInput, setMpvPathInput] = useState(settings.mpvPath || "");
	const [pathValidating, setPathValidating] = useState(false);
	const [pathValid, setPathValid] = useState<boolean | null>(null);
	const currentBackend = getCurrentBackendType();

	// Check MPV availability on mount and when path changes
	useEffect(() => {
		if (isMpvAvailable) {
			checkMpvInstalled().then(setMpvInstalled);
		}
	}, [isMpvAvailable]);

	// Sync mpvPath from settings when it changes externally
	useEffect(() => {
		setMpvPathInput(settings.mpvPath || "");
	}, [settings.mpvPath]);

	const handleBackendChange = (value: string) => {
		const backend = value as AudioBackend;
		setAudioBackend(backend);
		switchAudioBackend(backend);
	};

	const handlePathChange = (value: string) => {
		setMpvPathInput(value);
		setPathValid(null);
	};

	const handleBrowsePath = async () => {
		if (!window.electronAPI?.mpv?.selectPath) return;

		const selectedPath = await window.electronAPI.mpv.selectPath();
		if (selectedPath) {
			setMpvPathInput(selectedPath);
			await validateAndSavePath(selectedPath);
		}
	};

	const validateAndSavePath = async (pathToValidate: string) => {
		if (!window.electronAPI?.mpv) return;

		setPathValidating(true);
		try {
			// Test if the path is valid
			const isValid = await window.electronAPI.mpv.isAvailable(
				pathToValidate || undefined,
			);
			setPathValid(isValid);

			if (isValid) {
				// Save to settings
				setMpvPath(pathToValidate || undefined);
				// Update the main process
				await window.electronAPI.mpv.setPath(pathToValidate);
				// Re-check installation status
				setMpvInstalled(true);
			}
		} catch {
			setPathValid(false);
		} finally {
			setPathValidating(false);
		}
	};

	const handlePathBlur = () => {
		if (mpvPathInput !== (settings.mpvPath || "")) {
			validateAndSavePath(mpvPathInput);
		}
	};

	const handlePathKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			validateAndSavePath(mpvPathInput);
		}
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-foreground">Settings</h1>
				<p className="text-muted-foreground mt-1">Configure your preferences</p>
			</div>

			<div className="max-w-2xl space-y-6">
				{/* Appearance Settings */}
				<Card>
					<CardHeader>
						<CardTitle>Appearance</CardTitle>
						<CardDescription>Customize the look and feel</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label>Dynamic Player Background</Label>
								<p className="text-sm text-muted-foreground">
									Use colors from album art for the expanded player background
								</p>
							</div>
							<Switch
								checked={settings.dynamicPlayerBackground}
								onCheckedChange={setDynamicPlayerBackground}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Audio</CardTitle>
						<CardDescription>Configure audio playback settings</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label>Audio Backend</Label>
							<Select
								value={settings.audioBackend}
								onValueChange={handleBackendChange}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select audio backend" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="html5">HTML5 Audio (Default)</SelectItem>
									<SelectItem value="mpv" disabled={!isElectron}>
										MPV
										{!isElectron && " (Electron only)"}
									</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-sm text-muted-foreground">
								{settings.audioBackend === "html5"
									? "Uses the browser's built-in audio player. Works everywhere with good codec support."
									: "Uses MPV for playback. Requires MPV to be installed. Supports more formats and higher quality audio."}
							</p>
							{currentBackend !== settings.audioBackend && (
								<p className="text-sm text-amber-500">
									Backend will switch when you play a new track.
								</p>
							)}
						</div>

						{/* MPV Path Configuration - show when MPV is selected or in Electron */}
						{isElectron && settings.audioBackend === "mpv" && (
							<>
								<Separator />
								<div className="space-y-2">
									<Label>MPV Path (optional)</Label>
									<div className="flex gap-2">
										<Input
											value={mpvPathInput}
											onChange={(e) => handlePathChange(e.target.value)}
											onBlur={handlePathBlur}
											onKeyDown={handlePathKeyDown}
											placeholder="Leave empty to use system PATH"
											className={
												pathValid === false
													? "border-destructive"
													: pathValid === true
														? "border-green-500"
														: ""
											}
										/>
										<Button
											variant="outline"
											size="icon"
											onClick={handleBrowsePath}
											title="Browse for MPV executable"
										>
											<FolderOpen className="h-4 w-4" />
										</Button>
									</div>
									<p className="text-sm text-muted-foreground">
										{pathValidating
											? "Validating..."
											: pathValid === false
												? "Invalid path - MPV not found at this location"
												: pathValid === true
													? "Valid MPV installation found"
													: "Specify a custom path to the MPV executable, or leave empty to auto-detect from system PATH"}
									</p>
								</div>
							</>
						)}

						<Separator />

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Current Backend</span>
								<span className="text-sm text-muted-foreground capitalize">
									{currentBackend}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Running in Electron</span>
								<span className="text-sm text-muted-foreground">
									{isElectron ? "Yes" : "No"}
								</span>
							</div>
							{isElectron && (
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">MPV Available</span>
									<span className="text-sm text-muted-foreground">
										{mpvInstalled === null
											? "Checking..."
											: mpvInstalled
												? "Yes"
												: "No"}
									</span>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{isElectron &&
					!mpvInstalled &&
					mpvInstalled !== null &&
					settings.audioBackend === "mpv" && (
						<Card>
							<CardHeader>
								<CardTitle>Installing MPV</CardTitle>
								<CardDescription>
									MPV is not detected on your system
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-sm text-muted-foreground">
								<p>To use the MPV backend, either:</p>
								<ul className="list-disc list-inside space-y-1">
									<li>Specify the path to your MPV installation above, or</li>
									<li>Install MPV and ensure it's in your system PATH:</li>
								</ul>
								<ul className="list-disc list-inside space-y-1 ml-4">
									<li>
										<strong>macOS:</strong> <code>brew install mpv</code>
									</li>
									<li>
										<strong>Linux:</strong> <code>sudo apt install mpv</code> or
										your distro's package manager
									</li>
									<li>
										<strong>Windows:</strong> Download from{" "}
										<a
											href="https://mpv.io/installation/"
											className="text-primary hover:underline"
											target="_blank"
											rel="noopener noreferrer"
										>
											mpv.io
										</a>{" "}
										and add to PATH
									</li>
								</ul>
							</CardContent>
						</Card>
					)}
			</div>
		</div>
	);
}
