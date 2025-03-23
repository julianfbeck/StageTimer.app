/**
 * Interface for Cloudflare Durable Objects
 */
interface DurableObject {
	fetch(request: Request): Response | Promise<Response>;
	alarm?(alarmInfo?: AlarmInvocationInfo): void | Promise<void>;
	webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
	webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>;
	webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
}

interface AlarmInvocationInfo {
	readonly isRetry: boolean;
	readonly retryCount: number;
} 