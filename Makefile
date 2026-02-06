.PHONY: help install start dev clean install-service setup uninstall-service status logs test

# Default target
help:
	@echo "🕌 Athan Clock - Available Make Targets"
	@echo "========================================"
	@echo ""
	@echo "  make install          - Install npm dependencies"
	@echo "  make start            - Start the application"
	@echo "  make dev              - Start in development mode"
	@echo "  make setup            - Run full installation script"
	@echo "  make install-service  - Install systemd service"
	@echo "  make uninstall-service - Remove systemd service"
	@echo "  make status           - Check systemd service status"
	@echo "  make logs             - View systemd service logs"
	@echo "  make clean            - Clean node_modules and build artifacts"
	@echo "  make test             - Run tests (if available)"
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

# Run the installation script
setup:
	@echo "⚙️  Running installation script..."
	chmod +x scripts/install.sh
	./scripts/install.sh

# Install systemd service
install-service:
	@echo "⚙️  Installing systemd service..."
	sudo cp scripts/athan-clock.service /etc/systemd/system/
	sudo systemctl daemon-reload
	sudo systemctl enable athan-clock.service
	@echo "✅ Service installed and enabled"
	@echo "   Start with: sudo systemctl start athan-clock.service"

# Uninstall systemd service
uninstall-service:
	@echo "🗑️  Removing systemd service..."
	sudo systemctl stop athan-clock.service || true
	sudo systemctl disable athan-clock.service || true
	sudo rm -f /etc/systemd/system/athan-clock.service
	sudo systemctl daemon-reload
	@echo "✅ Service removed"

# Check service status
status:
	@echo "📊 Service status:"
	sudo systemctl status athan-clock.service || echo "Service not installed"

# View service logs
logs:
	@echo "📋 Service logs (press Ctrl+C to exit):"
	sudo journalctl -u athan-clock.service -f

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -rf node_modules
	rm -rf config/*.json
	@echo "✅ Clean complete"

# Run tests (placeholder - add actual tests if needed)
test:
	@echo "🧪 Running tests..."
	@echo "No tests configured yet"
