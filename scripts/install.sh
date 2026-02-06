#!/bin/bash

# Athan Clock Installation Script for Linux
# This script installs the Athan Clock application and sets it up to run on boot

set -e

echo "🕌 Athan Clock Installation Script"
echo "=================================="
echo ""

# Check if running as root for systemd installation
if [ "$EUID" -eq 0 ]; then 
   echo "Please do not run this script as root. It will ask for sudo when needed."
   exit 1
fi

# Get the current directory (should be the project root)
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_HOME="$HOME"
APP_DIR="$USER_HOME/athan-clock"

echo "Installation directory: $INSTALL_DIR"
echo "Target directory: $APP_DIR"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) found"
echo ""

# Create application directory
echo "📁 Creating application directory..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/assets/athan"
mkdir -p "$APP_DIR/assets/sounds"
mkdir -p "$APP_DIR/config"
mkdir -p "$APP_DIR/renderer/settings"

# Copy files
echo "📋 Copying application files..."
cp -r "$INSTALL_DIR"/* "$APP_DIR/" 2>/dev/null || true
cp -r "$INSTALL_DIR"/.github "$APP_DIR/" 2>/dev/null || true

# Install dependencies
echo "📦 Installing dependencies..."
cd "$APP_DIR"
npm install

# Create placeholder audio files if they don't exist
echo "🔊 Checking audio files..."
if [ ! -f "$APP_DIR/assets/athan/makkah.mp3" ]; then
    echo "⚠️  Warning: Audio files not found. Please add athan audio files to:"
    echo "   $APP_DIR/assets/athan/"
    echo "   Required files: makkah.mp3, madinah.mp3, mishary.mp3, abdulbasit.mp3"
fi

if [ ! -f "$APP_DIR/assets/sounds/notification.mp3" ]; then
    echo "⚠️  Warning: Notification sound not found. Please add to:"
    echo "   $APP_DIR/assets/sounds/notification.mp3"
fi

# Install systemd service
echo "⚙️  Installing systemd service..."
SERVICE_FILE="$APP_DIR/scripts/athan-clock.service"
SYSTEMD_FILE="/etc/systemd/system/athan-clock.service"

# Replace %i with actual username in service file
sed "s|%i|$USER|g; s|/home/$USER/athan-clock|$APP_DIR|g" "$SERVICE_FILE" | sudo tee "$SYSTEMD_FILE" > /dev/null

# Reload systemd
sudo systemctl daemon-reload

# Enable service (but don't start yet - user should configure first)
echo "✅ Systemd service installed"
echo ""

# Disable screen sleep
echo "🖥️  Configuring display settings..."
if command -v xset &> /dev/null; then
    xset s off
    xset -dpms
    xset s noblank
    echo "✅ Screen sleep disabled"
else
    echo "⚠️  xset not found. Screen sleep prevention may not work."
fi

echo ""
echo "=================================="
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Add athan audio files to: $APP_DIR/assets/athan/"
echo "2. Test the application: cd $APP_DIR && npm start"
echo "3. Configure settings: Open http://localhost:3000/settings.html in a browser"
echo "4. Enable auto-start: sudo systemctl enable athan-clock.service"
echo "5. Start the service: sudo systemctl start athan-clock.service"
echo ""
echo "Keyboard shortcuts:"
echo "  F11          - Toggle fullscreen"
echo "  Ctrl+Q       - Quit application"
echo "  Ctrl+S       - Open settings"
echo "  Ctrl+R       - Reload application"
echo ""
