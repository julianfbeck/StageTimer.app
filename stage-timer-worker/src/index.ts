import { ExecutionContext } from '@cloudflare/workers-types';
import { BroadcastHub } from './BroadcastHub';

// Main worker entry point
export default {
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Get timer ID from query params or use a default
		const timerId = url.searchParams.get("id") || "default";

		// Get BroadcastHub Durable Object for this timer
		const hubId = env.BROADCAST_HUB.idFromName(timerId);
		const hub = env.BROADCAST_HUB.get(hubId);

		// Timer display route
		if (path === "/" || path === "/timer") {
			// Serve the timer viewer page
			return env.ASSETS.fetch(new Request(`${url.origin}/timer.html`));
		}

		// Handle API and WebSocket connections
		if (path.startsWith("/api/timer")) {
			// Forward to the BroadcastHub
			return hub.fetch(request);
		}

		// Serve static assets
		return env.ASSETS.fetch(request);
	}
};

// Export the Durable Object
export { BroadcastHub };