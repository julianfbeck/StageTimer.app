import { TimerState, ClientMessage, ServerMessage, ClientRole } from './types';

/**
 * BroadcastHub - A Durable Object that only broadcasts timer updates
 * Does not tick or manage timer state independently
 */
export class BroadcastHub implements DurableObject {
	private state: DurableObjectState;
	private env: any;
	private sessions: Map<string, { webSocket: WebSocket, role: ClientRole }> = new Map();
	private timerState: TimerState;
	private primaryClientId: string | null = null;
	private lastActivity = Date.now();
  
	constructor(state: DurableObjectState, env: any) {
	  this.state = state;
	  this.env = env;
	  this.timerState = {
		running: false,
		startTime: null,
		duration: 300000, // Default: 5 minutes
		remainingTime: 300000,
		label: 'Stage Timer',
		color: '#ffffff',
		lastUpdateTime: Date.now()
	  };
	  
	  // Load any persistent state
	  this.initialize();
	}

	async initialize() {
		// Load stored state
		const storedState = await this.state.storage.get<{
			timerState: TimerState,
			primaryClientId: string | null
		}>("hubState");

		if (storedState) {
			this.timerState = storedState.timerState;
			this.primaryClientId = storedState.primaryClientId;
		}
	}

	// Handle HTTP requests and WebSocket upgrades
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Parse timer ID from request
		const timerId = url.searchParams.get("id") || "default";

		// Handle WebSocket connections
		if (request.headers.get("Upgrade") === "websocket") {
			// Check if the client is requesting primary role
			const requestedRole = url.searchParams.get("role") || "viewer";
			return this.handleWebSocket(request, requestedRole as ClientRole);
		}

		// Handle HTTP requests for timer status
		if (path === "/api/timer/status") {
			return new Response(JSON.stringify(this.timerState), {
				headers: { "Content-Type": "application/json" }
			});
		}

		// Default response
		return new Response("Not found", { status: 404 });
	}

	// Handle WebSocket connections
	async handleWebSocket(request: Request, requestedRole: ClientRole): Promise<Response> {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Generate a unique client ID
		const clientId = crypto.randomUUID();

		// Determine if this client can become primary
		let assignedRole = requestedRole;

		if (requestedRole === ClientRole.PRIMARY) {
			// If no primary exists or the previous primary has disconnected, allow this client to be primary
			if (!this.primaryClientId || !this.sessions.has(this.primaryClientId)) {
				this.primaryClientId = clientId;
				await this.persistState();
			} else {
				// There's already an active primary client
				assignedRole = ClientRole.VIEWER;
			}
		}

		// Configure the WebSocket
		await this.configureWebSocket(server as WebSocket, clientId, assignedRole);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	// Configure a new WebSocket connection
	async configureWebSocket(webSocket: WebSocket, clientId: string, role: ClientRole): Promise<void> {
		webSocket.accept();

		// Store the session
		this.sessions.set(clientId, { webSocket, role });

		// Update last activity time
		this.lastActivity = Date.now();

		// Send initial role assignment and current state
		webSocket.send(JSON.stringify({
			type: "roleAssignment",
			role: role,
			isPrimary: role === ClientRole.PRIMARY
		}));

		webSocket.send(JSON.stringify({
			type: "timerUpdate",
			data: this.timerState
		}));

		// Handle incoming messages
		webSocket.addEventListener("message", async (msg) => {
			try {
				// Handle ping/pong messages for connection keepalive
				if (msg.data === "ping") {
					webSocket.send("pong");
					return;
				}

				const data = JSON.parse(msg.data as string);

				// Only process control messages from the primary client
				if (role === ClientRole.PRIMARY) {
					// Update our last activity timestamp
					this.lastActivity = Date.now();

					// If this is a timer update, broadcast it to all clients
					if (data.type === "timerUpdate" && data.data) {
						// Update our stored state with the primary's state
						this.timerState = data.data;
						this.timerState.lastUpdateTime = Date.now();

						// Persist the state
						await this.persistState();

						// Broadcast to all other clients
						this.broadcastUpdate(clientId);
					}
					// Handle control messages
					else if (data.type === "control") {
						await this.handleControlMessage(data, clientId);
					}
				}
				// Non-primary clients can request to become primary
				else if (data.type === "requestPrimaryRole") {
					await this.handlePrimaryRoleRequest(clientId);
				}
			} catch (error) {
				webSocket.send(JSON.stringify({
					type: "error",
					message: `Failed to process message: ${error instanceof Error ? error.message : "Unknown error"}`
				}));
			}
		});

		// Handle disconnections
		webSocket.addEventListener("close", () => {
			this.handleDisconnection(clientId);
		});

		webSocket.addEventListener("error", () => {
			this.handleDisconnection(clientId);
		});
	}

	// Handle client disconnections
	private async handleDisconnection(clientId: string): Promise<void> {
		// Remove the client from our sessions
		this.sessions.delete(clientId);

		// If this was the primary client, we need to clear that state
		if (this.primaryClientId === clientId) {
			this.primaryClientId = null;
			await this.persistState();

			// Notify all clients that the primary has disconnected
			this.broadcastToPrimary(null, {
				type: "primaryDisconnected"
			});
		}
	}

	// Handle a request to become the primary client
	private async handlePrimaryRoleRequest(clientId: string): Promise<void> {
		const clientSession = this.sessions.get(clientId);
		if (!clientSession) return;

		// Check if there's no primary or the current primary disconnected
		if (!this.primaryClientId || !this.sessions.has(this.primaryClientId)) {
			// Assign this client as primary
			this.primaryClientId = clientId;
			clientSession.role = ClientRole.PRIMARY;

			// Update the session
			this.sessions.set(clientId, clientSession);

			// Persist state
			await this.persistState();

			// Notify the new primary
			clientSession.webSocket.send(JSON.stringify({
				type: "roleAssignment",
				role: ClientRole.PRIMARY,
				isPrimary: true
			}));

			// Notify all clients about the new primary
			this.broadcastToPrimary(clientId, {
				type: "primaryChanged",
				clientId: clientId
			});
		} else {
			// Reject the request - there's already an active primary
			clientSession.webSocket.send(JSON.stringify({
				type: "roleAssignment",
				role: ClientRole.VIEWER,
				isPrimary: false,
				message: "There is already an active primary client"
			}));
		}
	}

	// Handle control messages from primary client
	private async handleControlMessage(message: any, senderId: string): Promise<void> {
		// Implement specific control message handling here
		// This could include specialized commands that don't fit in timerUpdate

		// Example: forcing all clients to refresh or clear their state
		if (message.action === "forceRefresh") {
			this.broadcastToPrimary(senderId, {
				type: "control",
				action: "refresh"
			});
		}
	}

	// Broadcast a timer update to all connected clients except the sender
	private broadcastUpdate(senderId: string | null = null): void {
		const update = JSON.stringify({
			type: "timerUpdate",
			data: this.timerState
		});

		for (const [clientId, { webSocket }] of this.sessions.entries()) {
			// Skip the sender to avoid echo
			if (senderId !== null && clientId === senderId) continue;

			try {
				webSocket.send(update);
			} catch (err) {
				// Clean up dead connections
				this.sessions.delete(clientId);

				// If this was the primary, clear that state
				if (this.primaryClientId === clientId) {
					this.primaryClientId = null;
				}
			}
		}
	}

	// Broadcast a message to all except the sender
	private broadcastToPrimary(senderId: string | null, message: any): void {
		const messageStr = JSON.stringify(message);

		for (const [clientId, { webSocket }] of this.sessions.entries()) {
			// Skip the sender
			if (senderId !== null && clientId === senderId) continue;

			try {
				webSocket.send(messageStr);
			} catch (err) {
				// Clean up dead connections
				this.sessions.delete(clientId);

				// If this was the primary, clear that state
				if (this.primaryClientId === clientId) {
					this.primaryClientId = null;
				}
			}
		}
	}

	// Persist the current state to storage
	private async persistState(): Promise<void> {
		await this.state.storage.put("hubState", {
			timerState: this.timerState,
			primaryClientId: this.primaryClientId
		});
	}
}