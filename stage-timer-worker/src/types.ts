/**
 * Represents the state of a timer
 */
export interface TimerState {
	running: boolean;
	startTime: number | null;
	duration: number;
	remainingTime: number;
	lastTick: number | null;
	label?: string;
	color?: string;
}

/**
 * Actions that can be performed on a timer
 */
export enum TimerAction {
	START = 'startTimer',
	PAUSE = 'pauseTimer',
	RESET = 'resetTimer',
	SET = 'setTimer',
	UPDATE_SETTINGS = 'updateSettings'
}

/**
 * Message sent from client to server
 */
export interface ClientMessage {
	action: TimerAction;
	data?: {
		duration?: number;
		label?: string;
		color?: string;
	};
}

/**
 * Message sent from server to client
 */
export interface ServerMessage {
	type: 'timerUpdate' | 'error';
	data?: TimerState;
	message?: string;
}