import SwiftUI
import Combine

// MARK: - Timer Models
enum ClientRole: String, Codable {
    case primary = "primary"
    case viewer = "viewer"
}

struct TimerState: Codable, Equatable {
    var running: Bool
    var startTime: TimeInterval?
    var duration: TimeInterval
    var remainingTime: TimeInterval
    var label: String?
    var color: String?
    var lastUpdateTime: TimeInterval
    
    var formattedTime: String {
        let totalSeconds = Int(ceil(remainingTime / 1000))
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    var isWarning: Bool {
        return remainingTime < 30000  // Less than 30 seconds
    }
}

enum TimerAction: String, Codable {
    case startTimer
    case pauseTimer
    case resetTimer
    case setTimer
    case updateSettings
}

enum MessageType: String, Codable {
    case timerUpdate
    case error
    case roleAssignment
    case primaryDisconnected
    case primaryChanged
    case control
    case requestPrimaryRole
}

struct ClientMessage: Codable {
    let action: TimerAction
    let data: TimerData?
    
    struct TimerData: Codable {
        let duration: TimeInterval?
        let label: String?
        let color: String?
    }
}

struct ServerMessage: Codable {
    let type: String
    let data: TimerState?
    let role: String?
    let isPrimary: Bool?
    let message: String?
    let action: String?
    let clientId: String?
}

// MARK: - ViewModel for iPad Timer
class PrimaryTimerViewModel: ObservableObject {
    // State
    @Published var timerState = TimerState(
        running: false,
        startTime: nil,
        duration: 300000,  // 5 minutes in milliseconds
        remainingTime: 300000,
        label: "Stage Timer",
        color: "#ffffff",
        lastUpdateTime: Date().timeIntervalSince1970 * 1000
    )
    
    @Published var isPrimary = false
    @Published var connectionStatus = "Disconnected"
    @Published var isConnected = false
    @Published var minutes: Int = 5
    @Published var seconds: Int = 0
    @Published var customLabel: String = "Stage Timer"
    
    // Local timer management
    private var timer: Timer?
    private var webSocket: URLSessionWebSocketTask?
    private var reconnectTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var pingTimer: Timer?
    
    // Server URL
    private let serverURL: URL
    
    init(serverURL: URL? = nil) {
        // Use provided URL or default
        self.serverURL = serverURL ?? URL(string: "wss://stage-timer-worker.beanvault.workers.dev/api/timer?id=default&role=primary")!
        
        // Start connection
        connect()
        
        // Start ping timer
        setupPingTimer()
    }
    
    deinit {
        stopTimer()
        disconnect()
    }
    
    // MARK: - WebSocket Connection
    
    func connect() {
        guard webSocket == nil else { return }
        
        updateConnectionStatus("Connecting...")
        
        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: serverURL)
        
        // Start receiving messages
        webSocket?.resume()
        receiveMessage()
        
        // Reset reconnect attempts
        reconnectAttempts = 0
    }
    
    func disconnect() {
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        isConnected = false
        updateConnectionStatus("Disconnected")
        
        // Stop timers
        pingTimer?.invalidate()
        reconnectTimer?.invalidate()
    }
    
    private func setupPingTimer() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }
    
    private func sendPing() {
        guard let webSocket = webSocket, webSocket.state == .running else { return }
        
        webSocket.send(.string("ping")) { error in
            if let error = error {
                print("Error sending ping: \(error)")
            }
        }
    }
    
    private func attemptReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            updateConnectionStatus("Failed to reconnect")
            return
        }
        
        reconnectAttempts += 1
        let delay = min(Double(pow(2, Double(reconnectAttempts))), 30)
        
        updateConnectionStatus("Reconnecting in \(Int(delay))s... (\(reconnectAttempts)/\(maxReconnectAttempts))")
        
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.webSocket = nil
            self?.connect()
        }
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                self.handleWebSocketMessage(message)
                
                // Continue receiving messages
                self.receiveMessage()
                
            case .failure(let error):
                print("WebSocket receive error: \(error)")
                self.isConnected = false
                self.updateConnectionStatus("Disconnected: \(error.localizedDescription)")
                self.attemptReconnect()
            }
        }
    }
    
    private func handleWebSocketMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            // Handle ping/pong
            if text == "ping" {
                sendStringMessage("pong")
                return
            } else if text == "pong" {
                // Ping received, connection is alive
                return
            }
            
            // Parse JSON messages
            if let data = text.data(using: .utf8) {
                do {
                    let serverMessage = try JSONDecoder().decode(ServerMessage.self, from: data)
                    handleServerMessage(serverMessage)
                } catch {
                    print("Failed to decode message: \(error)")
                }
            }
            
        case .data(let data):
            // Handle binary data if needed
            print("Received binary data: \(data.count) bytes")
            
        @unknown default:
            print("Unknown message type received")
        }
    }
    
    private func handleServerMessage(_ message: ServerMessage) {
        DispatchQueue.main.async {
            switch message.type {
            case "roleAssignment":
                self.handleRoleAssignment(message)
                
            case "timerUpdate":
                // As the primary, we ignore timer updates from the server
                // We are the source of truth for the timer
                break
                
            case "primaryDisconnected":
                // We were disconnected as primary, try to reconnect
                self.reconnectAsPrimary()
                
            case "error":
                print("Server error: \(message.message ?? "Unknown error")")
                
            default:
                print("Unknown message type: \(message.type)")
            }
        }
    }
    
    private func handleRoleAssignment(_ message: ServerMessage) {
        if let isPrimary = message.isPrimary {
            self.isPrimary = isPrimary
            
            if isPrimary {
                updateConnectionStatus("Connected (Primary)")
                self.isConnected = true
                
                // If we're primary, start local timer if it was running
                if timerState.running {
                    startLocalTimer()
                }
            } else {
                updateConnectionStatus("Connected (Viewer)")
                self.isConnected = true
                
                // If we're not primary but should be, request primary role
                Task {
                    try await Task.sleep(nanoseconds: 1_000_000_000)  // Wait 1 second
                    self.requestPrimaryRole()
                }
            }
        }
    }
    
    private func reconnectAsPrimary() {
        // Request to become primary again
        self.requestPrimaryRole()
    }
    
    public func requestPrimaryRole() {
        let message = ["type": "requestPrimaryRole"]
        sendJsonMessage(message)
    }
    
    private func updateConnectionStatus(_ status: String) {
        DispatchQueue.main.async {
            self.connectionStatus = status
        }
    }
    
    // MARK: - Timer Control
    
    func startTimer() {
        guard isPrimary else {
            print("Cannot start timer - not primary")
            return
        }
        
        // Update local state
        timerState.running = true
        timerState.startTime = Date().timeIntervalSince1970 * 1000
        timerState.lastUpdateTime = Date().timeIntervalSince1970 * 1000
        
        // Start local timer
        startLocalTimer()
        
        // Broadcast update
        broadcastTimerState()
    }
    
    func pauseTimer() {
        guard isPrimary else {
            print("Cannot pause timer - not primary")
            return
        }
        
        // Update local state
        timerState.running = false
        timerState.lastUpdateTime = Date().timeIntervalSince1970 * 1000
        
        // Stop local timer
        stopTimer()
        
        // Broadcast update
        broadcastTimerState()
    }
    
    func resetTimer() {
        guard isPrimary else {
            print("Cannot reset timer - not primary")
            return
        }
        
        // Update local state
        timerState.running = false
        timerState.remainingTime = timerState.duration
        timerState.startTime = nil
        timerState.lastUpdateTime = Date().timeIntervalSince1970 * 1000
        
        // Stop local timer
        stopTimer()
        
        // Broadcast update
        broadcastTimerState()
    }
    
    func setTimer() {
        guard isPrimary else {
            print("Cannot set timer - not primary")
            return
        }
        
        let durationMs = TimeInterval((minutes * 60 + seconds) * 1000)
        
        // Update local state
        timerState.duration = durationMs
        timerState.remainingTime = durationMs
        timerState.lastUpdateTime = Date().timeIntervalSince1970 * 1000
        
        // Broadcast update
        broadcastTimerState()
    }
    
    func updateLabel() {
        guard isPrimary else {
            print("Cannot update label - not primary")
            return
        }
        
        // Update local state
        timerState.label = customLabel
        timerState.lastUpdateTime = Date().timeIntervalSince1970 * 1000
        
        // Broadcast update
        broadcastTimerState()
    }
    
    // MARK: - Local Timer Management
    
    private func startLocalTimer() {
        // Stop any existing timer
        stopTimer()
        
        // Create a new timer that fires every 100ms
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateLocalTime()
        }
    }
    
    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
    
    private func updateLocalTime() {
        guard timerState.running else { return }
        
        // Update remaining time
        let elapsedTime = 100.0  // 100ms elapsed
        timerState.remainingTime = max(0, timerState.remainingTime - elapsedTime)
        
        // Update last update time
        timerState.lastUpdateTime = Date().timeIntervalSince1970 * 1000
        
        // Check if timer completed
        if timerState.remainingTime <= 0 {
            timerState.running = false
            timerState.remainingTime = 0
            stopTimer()
        }
        
        // Broadcast updates at a slower rate (every 500ms) to reduce messages
        if Int(timerState.remainingTime) % 500 < 100 {
            broadcastTimerState()
        }
    }
    
    // MARK: - WebSocket Communication
    
    private func broadcastTimerState() {
        let message: [String: Any] = [
            "type": "timerUpdate",
            "data": [
                "running": timerState.running,
                "startTime": timerState.startTime as Any,
                "duration": timerState.duration,
                "remainingTime": timerState.remainingTime,
                "label": timerState.label as Any,
                "color": timerState.color as Any,
                "lastUpdateTime": timerState.lastUpdateTime
            ]
        ]
        
        sendJsonMessage(message)
    }
    
    private func sendJsonMessage(_ message: [String: Any]) {
        guard let webSocket = webSocket, webSocket.state == .running else {
            print("Cannot send message: WebSocket not connected")
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message)
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                webSocket.send(.string(jsonString)) { error in
                    if let error = error {
                        print("Error sending message: \(error)")
                    }
                }
            }
        } catch {
            print("Failed to encode message: \(error)")
        }
    }
    
    private func sendStringMessage(_ message: String) {
        guard let webSocket = webSocket, webSocket.state == .running else { return }
        
        webSocket.send(.string(message)) { error in
            if let error = error {
                print("Error sending message: \(error)")
            }
        }
    }
}

struct PrimaryTimerView: View {
    @StateObject private var viewModel = PrimaryTimerViewModel()
    @State private var showSettings = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Header with connection status
            HStack {
                Text("Stage Timer Control")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Spacer()
                
                HStack {
                    Circle()
                        .fill(viewModel.isConnected ? Color.green : Color.red)
                        .frame(width: 12, height: 12)
                    
                    Text(viewModel.connectionStatus)
                        .font(.subheadline)
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color.gray.opacity(0.1))
                .cornerRadius(20)
            }
            .padding(.horizontal)
            
            // Primary status indicator
            if viewModel.isPrimary {
                Text("PRIMARY CONTROLLER")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.blue)
                    .cornerRadius(8)
            } else {
                Text("VIEWER MODE")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.orange)
                    .cornerRadius(8)
                    .onTapGesture {
                        // Request primary role when tapped
                        viewModel.requestPrimaryRole()
                    }
            }
            
            Spacer()
            
            // Timer display
            VStack(spacing: 10) {
                if let label = viewModel.timerState.label, !label.isEmpty {
                    Text(label)
                        .font(.title)
                        .foregroundColor(.secondary)
                }
                
                Text(viewModel.timerState.formattedTime)
                    .font(.system(size: 120, weight: .bold, design: .monospaced))
                    .foregroundColor(viewModel.timerState.isWarning ? .red : .primary)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color.black.opacity(0.05))
                    )
            }
            
            Spacer()
            
            // Controls - only enabled when in Primary mode
            VStack(spacing: 30) {
                // Timer setup
                HStack(spacing: 20) {
                    VStack {
                        Text("Minutes")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        TextField("", value: $viewModel.minutes, formatter: NumberFormatter())
                            .keyboardType(.numberPad)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .multilineTextAlignment(.center)
                            .frame(width: 80)
                            .disabled(!viewModel.isPrimary)
                    }
                    
                    VStack {
                        Text("Seconds")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        TextField("", value: $viewModel.seconds, formatter: NumberFormatter())
                            .keyboardType(.numberPad)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .multilineTextAlignment(.center)
                            .frame(width: 80)
                            .disabled(!viewModel.isPrimary)
                    }
                    
                    Button(action: {
                        viewModel.setTimer()
                    }) {
                        Text("Set Timer")
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.bordered)
                    .tint(.blue)
                    .disabled(!viewModel.isPrimary)
                }
                
                // Timer controls
                HStack(spacing: 30) {
                    Button(action: {
                        viewModel.startTimer()
                    }) {
                        controlButton("Start", systemName: "play.fill", color: .green)
                    }
                    .disabled(!viewModel.isPrimary || viewModel.timerState.running)
                    
                    Button(action: {
                        viewModel.pauseTimer()
                    }) {
                        controlButton("Pause", systemName: "pause.fill", color: .yellow)
                    }
                    .disabled(!viewModel.isPrimary || !viewModel.timerState.running)
                    
                    Button(action: {
                        viewModel.resetTimer()
                    }) {
                        controlButton("Reset", systemName: "arrow.counterclockwise", color: .red)
                    }
                    .disabled(!viewModel.isPrimary)
                    
                    Button(action: {
                        showSettings.toggle()
                    }) {
                        controlButton("Settings", systemName: "gear", color: .gray)
                    }
                    .disabled(!viewModel.isPrimary)
                }
            }
            
            // Display URL for viewers
            if viewModel.isPrimary {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Share this URL for viewers:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    HStack {
                        Text("https://your-timer-domain.com/timer?id=default")
                            .font(.caption)
                            .padding(8)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(4)
                        
                        Button(action: {
                            // Copy URL to clipboard
                            UIPasteboard.general.string = "https://your-timer-domain.com/timer?id=default"
                        }) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                        }
                        .buttonStyle(.bordered)
                        .tint(.gray)
                    }
                }
                .padding()
                .background(Color.black.opacity(0.03))
                .cornerRadius(8)
                .padding(.horizontal)
            }
            
            Spacer()
        }
        .padding()
        .onAppear {
            // Automatically connect when view appears
            viewModel.connect()
        }
        .onDisappear {
            // Clean up when view disappears
            viewModel.disconnect()
        }
        .sheet(isPresented: $showSettings) {
            settingsView
        }
    }
    
    private func controlButton(_ text: String, systemName: String, color: Color) -> some View {
        VStack {
            Image(systemName: systemName)
                .font(.system(size: 30))
                .foregroundColor(.white)
                .frame(width: 70, height: 70)
                .background(color)
                .clipShape(Circle())
                .shadow(radius: 3)
            
            Text(text)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
    
    private var settingsView: some View {
        NavigationView {
            Form {
                Section(header: Text("Timer Label")) {
                    TextField("Label", text: $viewModel.customLabel)
                        .disabled(!viewModel.isPrimary)
                }
                
                if viewModel.isPrimary {
                    Section {
                        Button("Apply Settings") {
                            viewModel.updateLabel()
                            showSettings = false
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
            }
            .navigationTitle("Timer Settings")
            .navigationBarItems(trailing: Button("Done") {
                showSettings = false
            })
        }
    }
}
