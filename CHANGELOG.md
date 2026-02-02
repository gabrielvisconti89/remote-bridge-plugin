# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2024-01-15

### Added
- Comprehensive documentation (15 documentation files)
- Screenshot support via Playwright MCP integration
- Three tunneling options: Localtunnel (default), SSH tunnel, and local-only mode
- Real-time terminal output capture and streaming

### Changed
- Improved QR code display in terminal
- Enhanced statusline with connection and mode indicators
- Better error handling for tunnel failures

### Fixed
- Mode toggle reliability on macOS with Terminal.app
- WebSocket reconnection handling
- Command queue persistence across server restarts

## [1.2.0] - 2024-01-10

### Added
- Image upload support via `/file/upload` endpoint
- Mode switching support (Plan mode, Auto-accept mode)
- Statusline display showing connection status and metrics
- PostToolUse hook for activity notifications
- Skills system with `/remote-bridge:start`, `/remote-bridge:stop`, `/remote-bridge:status`, `/remote-bridge:inbox`

### Changed
- Refactored command execution from "typing mode" to "command queue mode"
- Commands now go through inbox for user review before execution
- Improved security by removing automatic command execution

### Fixed
- Terminal session detection for iTerm2 and Terminal.app
- API key generation on server startup

## [1.1.0] - 2024-01-05

### Added
- WebSocket heartbeat for connection monitoring
- Client device name tracking
- Message metrics (sent/received counters)
- System information endpoint (`/system/info`)
- Load average endpoint (`/system/load`)
- Network interfaces endpoint (`/system/network`)

### Changed
- Improved logging with Winston-style formatter
- Better error responses with consistent format

### Fixed
- Memory leak in WebSocket client tracking
- Race condition in state file writes

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Express + WebSocket server for remote control
- HTTP REST API for commands, files, and system info
- WebSocket API for real-time communication
- QR code connection flow with Localtunnel
- API key authentication
- File operations (read, write, list, delete)
- Shell command execution
- Command queue system (inbox)
- State persistence in `~/.claude/remote-bridge/`
- SessionStart and SessionEnd hooks
- Basic documentation

### Security
- API key authentication for all endpoints
- Sensitive environment variables redaction
- Input validation on all endpoints

[1.2.1]: https://github.com/user/remote-bridge-plugin/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/user/remote-bridge-plugin/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/remote-bridge-plugin/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/remote-bridge-plugin/releases/tag/v1.0.0
