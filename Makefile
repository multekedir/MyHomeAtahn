# Athan Clock — Makefile
# Use: make help (default), make install, make start, etc.
# Note: install-service, uninstall-service, status, logs are for Linux (systemd).

.PHONY: help install start dev clean install-service setup uninstall-service status logs test open-settings test-features test-athan test-ramadan

# Default target
help:
	@echo "🕌 Athan Clock - Make Targets"
	@echo "============================="
	@echo ""
	@echo "  make install          Install npm dependencies"
	@echo "  make start            Start the application (fullscreen)"
	@echo "  make dev              Start in development mode"
	@echo "  make open-settings    Print settings URL (open in browser when app is running)"
	@echo "  make setup            Run full installation script (Linux)"
	@echo "  make install-service  Install systemd service (Linux)"
	@echo "  make uninstall-service Remove systemd service (Linux)"
	@echo "  make status           Show systemd service status (Linux)"
	@echo "  make logs             Follow systemd service logs (Linux)"
	@echo "  make clean            Remove node_modules and config/*.json"
	@echo "  make test             Run tests (placeholder)"
	@echo ""
	@echo "  Testing features:"
	@echo "  make test-features    Print testing cheat sheet, then start app"
	@echo "  make test-athan       Start app (use Ctrl+Shift+A / Cmd+Shift+A to trigger athan)"
	@echo "  make test-ramadan     Start app and print Ramadan overlay testing steps"
	@echo ""

# Install npm dependencies
install:
	@echo "📦 Installing dependencies..."
	npm install

# Start the application
start:
	@echo "🚀 Starting Athan Clock..."
	npm start

# Start in development mode
dev:
	@echo "🔧 Starting in development mode..."
	npm run dev

# Remind user how to open settings
open-settings:
	@echo "With the app running, open: http://localhost:3000/settings.html"
	@echo "Or press Ctrl+S (Cmd+S on Mac) in the app."

# Run the installation script (Linux)
setup:
	@echo "⚙️  Running installation script..."
	chmod +x scripts/install.sh
	./scripts/install.sh

# Install systemd service (Linux only)
install-service:
	@echo "⚙️  Installing systemd service..."
	sudo cp scripts/athan-clock.service /etc/systemd/system/
	sudo systemctl daemon-reload
	sudo systemctl enable athan-clock.service
	@echo "✅ Service installed and enabled"
	@echo "   Start: sudo systemctl start athan-clock.service"

# Uninstall systemd service (Linux only)
uninstall-service:
	@echo "🗑️  Removing systemd service..."
	sudo systemctl stop athan-clock.service 2>/dev/null || true
	sudo systemctl disable athan-clock.service 2>/dev/null || true
	sudo rm -f /etc/systemd/system/athan-clock.service
	sudo systemctl daemon-reload
	@echo "✅ Service removed"

# Check service status (Linux only)
status:
	@echo "📊 Service status:"
	@sudo systemctl status athan-clock.service 2>/dev/null || echo "Service not installed or not Linux."

# View service logs (Linux only)
logs:
	@echo "📋 Service logs (Ctrl+C to exit):"
	sudo journalctl -u athan-clock.service -f

# Clean build artifacts (keeps config dir, removes JSON)
clean:
	@echo "🧹 Cleaning..."
	rm -rf node_modules
	@rm -f config/*.json 2>/dev/null || true
	@echo "✅ Done"

# Tests (placeholder)
test:
	@echo "🧪 Running tests..."
	npm run test 2>/dev/null || echo "No tests configured."

# Print testing cheat sheet then start app
test-features:
	@echo "🕌 Athan Clock — Testing"
	@echo "========================="
	@echo ""
	@echo "  • Trigger athan:         Ctrl+Shift+A  (Cmd+Shift+A on Mac)"
	@echo "  • Test Ramadan overlay (no waiting):"
	@echo "      Maghrib:  Ctrl+Shift+R   (Cmd+Shift+R)"
	@echo "      Fajr:    Ctrl+Shift+F   (Cmd+Shift+F)"
	@echo "      Taraweeh: Ctrl+Shift+T  (Cmd+Shift+T)"
	@echo "    Each simulates that event in 30s → countdown then at-time with dua; tap to dismiss. 10 min."
	@echo "  • Real Ramadan: Settings → Enable Ramadan, set start/end dates. Countdowns at 5/15/10 min before."
	@echo "  • Chime (optional): add assets/athan/chime.mp3 for Maghrib/Taraweeh."
	@echo ""
	@echo "  Starting app..."
	@npm start

# Start app for athan testing (shortcut printed)
test-athan:
	@echo "🔊 Trigger athan: Ctrl+Shift+A (Windows/Linux) or Cmd+Shift+A (Mac)"
	@echo "   Starting app..."
	@npm start

# Start app and print Ramadan overlay testing steps
test-ramadan:
	@echo "🌙 Ramadan overlay testing"
	@echo "==========================="
	@echo "  Quick test (no waiting): Ctrl+Shift+R (Maghrib), Ctrl+Shift+F (Fajr), Ctrl+Shift+T (Taraweeh)."
	@echo "  Each: 30s countdown → at-time with dua (2–3 min). Tap to dismiss."
	@echo ""
	@echo "  Real schedule: Enable Ramadan in Settings, set start/end dates. Overlays at 5/15/10 min before."
	@echo ""
	@echo "  Starting app..."
	@npm start
