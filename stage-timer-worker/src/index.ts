import { ExecutionContext } from '@cloudflare/workers-types';
import { TimerState, ClientMessage, ServerMessage, TimerAction } from './types';
import { generateTimerWebsite } from './werbsite';

// Timer Durable Object implementation
export class TimerDurableObject {
	private state: DurableObjectState;
	private env: any;
	private sessions: Set<WebSocket>;
	private timerState: TimerState;
	private tickInterval: number | null = null;

	constructor(state: DurableObjectState, env: any) {
		this.state = state;
		this.env = env;
		this.sessions = new Set();
		this.timerState = {
			running: false,
			startTime: null,
			duration: 300000, // 5 minutes in milliseconds
			remainingTime: 300000,
			lastTick: null,
			label: 'Stage Timer',
			color: '#ffffff'
		};

		// Initialize and load persisted state
		this.initialize();
	}

	async initialize() {
		const storedTimerState = await this.state.storage.get<TimerState>("timerState");
		if (storedTimerState) {
			this.timerState = storedTimerState;

			// If the timer was running when last stored, determine if it should still be running
			if (this.timerState.running && this.timerState.lastTick) {
				const now = Date.now();
				const elapsed = now - this.timerState.lastTick;

				if (this.timerState.remainingTime <= elapsed) {
					// Timer would have completed
					this.timerState.running = false;
					this.timerState.remainingTime = 0;
				} else {
					// Timer should still be running, adjust remaining time
					this.timerState.remainingTime -= elapsed;
					this.timerState.lastTick = now;

					// Restart the tick interval
					this.startTicking();
				}
			}
		}
	}

	// Handle HTTP requests and WebSocket upgrades
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Handle WebSocket connections
		if (request.headers.get("Upgrade") === "websocket") {
			return this.handleWebSocket(request);
		}

		// For standard HTTP endpoints
		if (path === "/api/timer/status") {
			return new Response(JSON.stringify(this.timerState), {
				headers: { "Content-Type": "application/json" }
			});
		}

		// Default response for unknown endpoints
		return new Response("Not found", { status: 404 });
	}

	// Handle WebSocket connections
	async handleWebSocket(request: Request): Promise<Response> {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		await this.configureWebSocket(server as WebSocket);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	// Configure a new WebSocket connection
	async configureWebSocket(webSocket: WebSocket): Promise<void> {
		webSocket.accept();
		this.sessions.add(webSocket);

		// Send current state to the new client
		this.sendUpdate(webSocket);

		// Handle incoming messages
		webSocket.addEventListener("message", async (msg) => {
			try {
				const data = JSON.parse(msg.data as string) as ClientMessage;
				await this.handleClientMessage(data);
			} catch (error) {
				webSocket.send(JSON.stringify({
					type: "error",
					message: `Failed to process message: ${error instanceof Error ? error.message : "Unknown error"}`
				} as ServerMessage));
			}
		});

		// Handle disconnections
		webSocket.addEventListener("close", () => {
			this.sessions.delete(webSocket);
		});

		webSocket.addEventListener("error", () => {
			this.sessions.delete(webSocket);
		});
	}

	// Process messages from clients
	async handleClientMessage(message: ClientMessage): Promise<void> {
		switch (message.action) {
			case TimerAction.START:
				await this.startTimer(message.data?.duration);
				break;
			case TimerAction.PAUSE:
				await this.pauseTimer();
				break;
			case TimerAction.RESET:
				await this.resetTimer();
				break;
			case TimerAction.SET:
				if (message.data?.duration !== undefined) {
					await this.setTimer(message.data.duration);
				}
				break;
			case TimerAction.UPDATE_SETTINGS:
				await this.updateSettings(message.data);
				break;
			default:
				throw new Error("Unknown action");
		}
	}

	// Start the timer
	async startTimer(duration: number | undefined = undefined): Promise<void> {
		if (duration !== undefined) {
			this.timerState.duration = duration;
			this.timerState.remainingTime = duration;
		}

		this.timerState.running = true;
		this.timerState.startTime = Date.now();
		this.timerState.lastTick = Date.now();

		await this.state.storage.put("timerState", this.timerState);
		this.broadcastUpdate();

		this.startTicking();
	}

	// Start timer tick interval
	private startTicking(): void {
		if (!this.tickInterval) {
			// Use setInterval for consistency but with async handling
			this.tickInterval = setInterval(() => {
				this.tick().catch(err => console.error("Tick error:", err));
			}, 100) as unknown as number;
		}
	}

	// Pause the timer
	async pauseTimer(): Promise<void> {
		this.timerState.running = false;
		await this.state.storage.put("timerState", this.timerState);
		this.broadcastUpdate();

		this.stopTicking();
	}

	// Stop timer tick interval
	private stopTicking(): void {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	// Reset the timer
	async resetTimer(): Promise<void> {
		this.timerState.running = false;
		this.timerState.remainingTime = this.timerState.duration;
		this.timerState.startTime = null;
		this.timerState.lastTick = null;

		await this.state.storage.put("timerState", this.timerState);
		this.broadcastUpdate();

		this.stopTicking();
	}

	// Set a new timer duration
	async setTimer(duration: number): Promise<void> {
		this.timerState.duration = duration;
		this.timerState.remainingTime = duration;

		await this.state.storage.put("timerState", this.timerState);
		this.broadcastUpdate();
	}

	// Update timer settings
	async updateSettings(settings: any): Promise<void> {
		if (settings?.label !== undefined) {
			this.timerState.label = settings.label;
		}

		if (settings?.color !== undefined) {
			this.timerState.color = settings.color;
		}

		await this.state.storage.put("timerState", this.timerState);
		this.broadcastUpdate();
	}

	// Timer tick function to update time
	async tick(): Promise<void> {
		if (!this.timerState.running) return;

		const now = Date.now();
		const elapsed = now - (this.timerState.lastTick || now);
		this.timerState.lastTick = now;

		this.timerState.remainingTime = Math.max(0, this.timerState.remainingTime - elapsed);

		if (this.timerState.remainingTime <= 0) {
			this.timerState.running = false;
			this.timerState.remainingTime = 0;
			this.stopTicking();
		}

		await this.state.storage.put("timerState", this.timerState);
		this.broadcastUpdate();
	}

	// Send an update to a specific client
	sendUpdate(client: WebSocket): void {
		try {
			client.send(JSON.stringify({
				type: "timerUpdate",
				data: this.timerState
			} as ServerMessage));
		} catch (err) {
			// Handle potential errors
			this.sessions.delete(client);
		}
	}

	// Broadcast updates to all connected clients
	broadcastUpdate(): void {
		const update = JSON.stringify({
			type: "timerUpdate",
			data: this.timerState
		} as ServerMessage);

		for (const session of this.sessions) {
			try {
				session.send(update);
			} catch (err) {
				// Clean up dead connections
				this.sessions.delete(session);
			}
		}
	}
}

// Worker script to route requests
export default {
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Get timer ID from query params or use a default
		const timerId = url.searchParams.get("id") || "default";

		// Main routes
		if (path === "/" || path === "/timer") {
			// Serve the timer display website
			return new Response(generateTimerWebsite(timerId), {
				headers: { "Content-Type": "text/html" }
			});
		}

		// Control panel route - could be implemented separately
		if (path === "/control") {
			// For now, redirect to the main timer page
			return Response.redirect(`/timer?id=${encodeURIComponent(timerId)}`, 302);
		}

		// Route timer-related API requests to the appropriate Durable Object
		if (path.startsWith("/api/timer")) {
			// Get Durable Object for this timer
			const timerObjectId = env.TIMER.idFromName(timerId);
			const timerObject = env.TIMER.get(timerObjectId);

			// Forward the request to the Durable Object
			return timerObject.fetch(request);
		}

		// Serve static content for everything else if you have assets configured
		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		// 404 for everything else
		return new Response("Not found", { status: 404 });
	}
};