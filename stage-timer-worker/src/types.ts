/**
 * Enum representing the role of a connected client
 */
export enum ClientRole {
	PRIMARY = 'primary',
	VIEWER = 'viewer'
  }
  
  /**
   * Represents the state of a timer
   */
  export interface TimerState {
	running: boolean;
	startTime: number | null;
	duration: number;
	remainingTime: number;
	label?: string;
	color?: string;
	lastUpdateTime: number; // When the state was last updated by primary
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
	type: 'timerUpdate' | 'error' | 'roleAssignment' | 'primaryDisconnected' | 'primaryChanged' | 'control';
	data?: TimerState;
	role?: ClientRole;
	isPrimary?: boolean;
	message?: string;
	action?: string;
	clientId?: string;
  }