import { TimerState } from './types';

/**
 * Generates the HTML for the timer control panel
 * 
 * @param timerId The ID of the timer to control
 * @param initialState Optional initial timer state
 * @returns HTML string for the timer control panel
 */
export function generateControlPanel(timerId: string, initialState?: TimerState): string {
	const encodedTimerId = encodeURIComponent(timerId);

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stage Timer Control</title>
  <style>
    :root {
      --primary-color: #2563eb;
      --primary-hover: #1d4ed8;
      --danger-color: #dc2626;
      --danger-hover: #b91c1c;
      --warning-color: #f59e0b;
      --warning-hover: #d97706;
      --success-color: #10b981;
      --success-hover: #059669;
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --text-color: #1e293b;
      --text-secondary: #64748b;
      --border-color: #e2e8f0;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --primary-color: #3b82f6;
        --primary-hover: #2563eb;
        --danger-color: #ef4444;
        --danger-hover: #dc2626;
        --warning-color: #f59e0b;
        --warning-hover: #d97706;
        --success-color: #10b981;
        --success-hover: #059669;
        --bg-color: #0f172a;
        --card-bg: #1e293b;
        --text-color: #f1f5f9;
        --text-secondary: #94a3b8;
        --border-color: #334155;
      }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    .container {
      background-color: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 2rem;
      width: 100%;
      max-width: 600px;
      margin: 2rem;
      border: 1px solid var(--border-color);
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }
    
    .title {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
      color: var(--text-color);
    }
    
    .connection-status {
      display: flex;
      align-items: center;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .connected {
      background-color: var(--success-color);
    }
    
    .disconnected {
      background-color: var(--danger-color);
    }

    .timer-display {
      font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
      font-size: 4rem;
      font-weight: 700;
      text-align: center;
      margin: 1.5rem 0;
      font-variant-numeric: tabular-nums;
      color: var(--text-color);
    }
    
    .timer-warning {
      color: var(--warning-color);
    }
    
    .timer-settings {
      margin-bottom: 2rem;
      padding: 1.5rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background-color: rgba(0, 0, 0, 0.02);
    }
    
    .form-group {
      margin-bottom: 1.5rem;
    }
    
    .form-group:last-child {
      margin-bottom: 0;
    }
    
    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--text-color);
    }
    
    .time-inputs {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    
    .input-group {
      display: flex;
      flex-direction: column;
    }
    
    .input-suffix {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }
    
    input[type="number"],
    input[type="text"] {
      padding: 0.625rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 1rem;
      background-color: var(--card-bg);
      color: var(--text-color);
      width: 5rem;
      text-align: center;
    }
    
    input[type="text"] {
      width: 100%;
      text-align: left;
    }
    
    button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.1s ease;
    }
    
    button:hover {
      transform: translateY(-1px);
    }
    
    button:active {
      transform: translateY(1px);
    }
    
    .btn-primary {
      background-color: var(--primary-color);
      color: white;
    }
    
    .btn-primary:hover {
      background-color: var(--primary-hover);
    }
    
    .btn-success {
      background-color: var(--success-color);
      color: white;
    }
    
    .btn-success:hover {
      background-color: var(--success-hover);
    }
    
    .btn-warning {
      background-color: var(--warning-color);
      color: white;
    }
    
    .btn-warning:hover {
      background-color: var(--warning-hover);
    }
    
    .btn-danger {
      background-color: var(--danger-color);
      color: white;
    }
    
    .btn-danger:hover {
      background-color: var(--danger-hover);
    }
    
    .btn-group {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .preset-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .preset-btn {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-color);
      padding: 0.5rem;
      font-size: 0.875rem;
    }
    
    .preset-btn:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 2rem 0 1rem;
      color: var(--text-color);
    }
    
    .timer-controls {
      margin-top: 2rem;
    }
    
    .display-url {
      margin-top: 2rem;
      padding: 1rem;
      background-color: rgba(0, 0, 0, 0.03);
      border-radius: 6px;
      font-size: 0.875rem;
      word-break: break-all;
    }
    
    .label-text {
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    
    .copy-btn {
      background: none;
      border: 1px solid var(--border-color);
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }
    
    @media (prefers-color-scheme: dark) {
      .preset-btn:hover, 
      .copy-btn:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      .timer-settings {
        background-color: rgba(255, 255, 255, 0.03);
      }
      
      .display-url {
        background-color: rgba(255, 255, 255, 0.03);
      }
    }
    
    .footer {
      text-align: center;
      margin-top: 2rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    
    @media (max-width: 640px) {
      .container {
        margin: 1rem;
        padding: 1.5rem;
      }
      
      .timer-display {
        font-size: 3rem;
      }
      
      .btn-group {
        flex-direction: column;
      }
      
      button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Stage Timer Control</h1>
      <div class="connection-status">
        <div class="status-indicator disconnected" id="status-indicator"></div>
        <span id="connection-status">Connecting...</span>
      </div>
    </div>
    
    <div class="timer-display" id="timer-display">00:00</div>
    
    <div class="timer-settings">
      <div class="form-group">
        <label class="form-label">Set Timer Duration</label>
        <div class="time-inputs">
          <div class="input-group">
            <input type="number" id="minutes-input" min="0" max="999" value="5">
            <span class="input-suffix">minutes</span>
          </div>
          
          <div class="input-group">
            <input type="number" id="seconds-input" min="0" max="59" value="0">
            <span class="input-suffix">seconds</span>
          </div>
          
          <button class="btn-primary" id="set-timer-btn">Set Timer</button>
        </div>
        
        <div class="preset-buttons">
          <button class="preset-btn" data-minutes="1" data-seconds="0">1:00</button>
          <button class="preset-btn" data-minutes="2" data-seconds="0">2:00</button>
          <button class="preset-btn" data-minutes="3" data-seconds="0">3:00</button>
          <button class="preset-btn" data-minutes="5" data-seconds="0">5:00</button>
          <button class="preset-btn" data-minutes="10" data-seconds="0">10:00</button>
          <button class="preset-btn" data-minutes="15" data-seconds="0">15:00</button>
          <button class="preset-btn" data-minutes="20" data-seconds="0">20:00</button>
          <button class="preset-btn" data-minutes="30" data-seconds="0">30:00</button>
          <button class="preset-btn" data-minutes="45" data-seconds="0">45:00</button>
          <button class="preset-btn" data-minutes="60" data-seconds="0">60:00</button>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="timer-label-input">Timer Label</label>
        <div class="time-inputs">
          <input type="text" id="timer-label-input" placeholder="Enter label" value="Stage Timer">
          <button class="btn-primary" id="set-label-btn">Set Label</button>
        </div>
      </div>
    </div>
    
    <h2 class="section-title">Timer Controls</h2>
    
    <div class="timer-controls btn-group">
      <button class="btn-success" id="start-btn">Start Timer</button>
      <button class="btn-warning" id="pause-btn">Pause Timer</button>
      <button class="btn-danger" id="reset-btn">Reset Timer</button>
    </div>
    
    <div class="display-url">
      <div class="label-text">
        Timer Display URL 
        <button class="copy-btn" id="copy-url-btn">Copy</button>
      </div>
      <div id="display-url">${window.location.origin}/timer?id=${encodedTimerId}</div>
    </div>
    
    <div class="footer">
      Powered by Cloudflare Workers
    </div>
  </div>

  <script>
    // DOM Elements
    const timerDisplay = document.getElementById('timer-display');
    const minutesInput = document.getElementById('minutes-input');
    const secondsInput = document.getElementById('seconds-input');
    const timerLabelInput = document.getElementById('timer-label-input');
    const setTimerBtn = document.getElementById('set-timer-btn');
    const setLabelBtn = document.getElementById('set-label-btn');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const connectionStatus = document.getElementById('connection-status');
    const displayUrlElement = document.getElementById('display-url');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    
    // Timer state
    let timerState = ${initialState ? JSON.stringify(initialState) : `{
      running: false,
      startTime: null,
      duration: 300000,
      remainingTime: 300000,
      lastTick: null,
      label: "Stage Timer"
    }`};
    
    let socket = null;
    let reconnectAttempts = 0;
    let reconnectInterval = null;
    const MAX_RECONNECT_ATTEMPTS = 10;
    
    // Format time as MM:SS
    function formatTime(milliseconds) {
      const totalSeconds = Math.ceil(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
    }
    
    // Update UI based on timer state
    function updateUI() {
      // Update timer display
      timerDisplay.textContent = formatTime(timerState.remainingTime);
      
      // Apply warning style if less than 30 seconds remaining
      if (timerState.remainingTime < 30000) {
        timerDisplay.classList.add('timer-warning');
      } else {
        timerDisplay.classList.remove('timer-warning');
      }
      
      // Update timer label input
      if (timerState.label) {
        timerLabelInput.value = timerState.label;
      }
      
      // Update buttons state
      startBtn.disabled = timerState.running;
      pauseBtn.disabled = !timerState.running;
      
      // Update page title
      document.title = \`\${formatTime(timerState.remainingTime)} - Timer Control\`;
    }
    
    // Connect to WebSocket
    function connect() {
      const timerId = "${encodedTimerId}";
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = \`\${protocol}//\${window.location.host}/api/timer?id=\${timerId}\`;
      
      // Close existing socket if any
      if (socket) {
        socket.close();
      }
      
      // Update connection status
      connectionStatus.textContent = 'Connecting...';
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('disconnected');
      
      // Create new WebSocket connection
      socket = new WebSocket(wsUrl);
      
      socket.addEventListener('open', () => {
        console.log('WebSocket connection established');
        connectionStatus.textContent = 'Connected';
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        
        // Reset reconnect attempts
        reconnectAttempts = 0;
        if (reconnectInterval) {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
        }
      });
      
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'timerUpdate' && message.data) {
            timerState = message.data;
            updateUI();
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });
      
      socket.addEventListener('close', () => {
        console.log('WebSocket connection closed');
        connectionStatus.textContent = 'Disconnected';
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        
        // Attempt to reconnect
        attemptReconnect();
      });
      
      socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        connectionStatus.textContent = 'Connection error';
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
      });
    }
    
    // Send a message to the server
    function sendMessage(action, data = {}) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const message = {
          action: action,
          data: data
        };
        
        socket.send(JSON.stringify(message));
      } else {
        console.error('Cannot send message: WebSocket not connected');
      }
    }
    
    // Attempt to reconnect with exponential backoff
    function attemptReconnect() {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        connectionStatus.textContent = 'Connection failed';
        return;
      }
      
      // Clear any existing reconnect interval
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
      
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      
      connectionStatus.textContent = \`Reconnecting in \${delay / 1000}s...\`;
      
      reconnectInterval = setTimeout(() => {
        connect();
      }, delay);
    }
    
    // Event Listeners
    setTimerBtn.addEventListener('click', () => {
      const minutes = parseInt(minutesInput.value, 10) || 0;
      const seconds = parseInt(secondsInput.value, 10) || 0;
      const duration = (minutes * 60 + seconds) * 1000;
      
      if (duration > 0) {
        sendMessage('setTimer', { duration: duration });
      }
    });
    
    setLabelBtn.addEventListener('click', () => {
      const label = timerLabelInput.value.trim();
      if (label) {
        sendMessage('updateSettings', { label: label });
      }
    });
    
    startBtn.addEventListener('click', () => {
      sendMessage('startTimer');
    });
    
    pauseBtn.addEventListener('click', () => {
      sendMessage('pauseTimer');
    });
    
    resetBtn.addEventListener('click', () => {
      sendMessage('resetTimer');
    });
    
    // Preset buttons
    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const minutes = parseInt(button.dataset.minutes, 10) || 0;
        const seconds = parseInt(button.dataset.seconds, 10) || 0;
        
        minutesInput.value = minutes;
        secondsInput.value = seconds;
        
        const duration = (minutes * 60 + seconds) * 1000;
        if (duration > 0) {
          sendMessage('setTimer', { duration: duration });
        }
      });
    });
    
    // Copy URL button
    copyUrlBtn.addEventListener('click', () => {
      const url = displayUrlElement.textContent;
      
      navigator.clipboard.writeText(url)
        .then(() => {
          const originalText = copyUrlBtn.textContent;
          copyUrlBtn.textContent = 'Copied!';
          
          setTimeout(() => {
            copyUrlBtn.textContent = originalText;
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy URL: ', err);
          alert('Failed to copy URL. Please select and copy it manually.');
        });
    });
    
    // Connect on page load
    window.addEventListener('load', () => {
      connect();
      updateUI();
    });
    
    // Reconnect when page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && 
          (socket === null || socket.readyState === WebSocket.CLOSED)) {
        connect();
      }
    });
  </script>
</body>
</html>`;
}