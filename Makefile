# Athan Clock — Makefile
# Use: make help (default), make install, make start, etc.
# Note: install-service, uninstall-service, status, logs are for Linux (systemd).

.PHONY: help install start dev clean install-service setup uninstall-service status logs test open-settings

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
