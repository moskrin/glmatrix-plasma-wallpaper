#!/bin/bash
#
# GL Matrix - KDE Plasma 6 wallpaper plugin
# Based on glmatrix from xscreensaver by Jamie Zawinski <jwz@jwz.org>
# See LICENSE for full copyright and permission notice.
#
# Build and install script
#
# Prerequisites:
#   sudo apt install qt6-shader-baker   # Debian/Ubuntu
#   sudo pacman -S qt6-shadertools      # Arch
#   sudo dnf install qt6-qtshadertools  # Fedora
#
# Usage:
#   ./build.sh          # Compile shader + install wallpaper plugin
#   ./build.sh build    # Compile shader only
#   ./build.sh install  # Install only (assumes shader already compiled)
#   ./build.sh remove   # Uninstall the wallpaper plugin

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="${SCRIPT_DIR}/package"
SHADER_SRC="${PACKAGE_DIR}/contents/ui/Shaders/glmatrix.frag"
SHADER_OUT="${PACKAGE_DIR}/contents/ui/Shaders6/glmatrix.frag.qsb"
PLUGIN_ID="com.github.kmatrix"

# Find qsb tool
QSB=""
for candidate in qsb /usr/lib/qt6/bin/qsb /usr/lib64/qt6/bin/qsb; do
    if command -v "$candidate" &>/dev/null; then
        QSB="$candidate"
        break
    fi
done

build_shader() {
    if [ -z "$QSB" ]; then
        echo "ERROR: qsb (Qt Shader Baker) not found."
        echo "Install it with your package manager:"
        echo "  Debian/Ubuntu: sudo apt install qt6-shader-baker"
        echo "  Arch:          sudo pacman -S qt6-shadertools"
        echo "  Fedora:        sudo dnf install qt6-qtshadertools"
        exit 1
    fi

    echo "Compiling shader..."
    mkdir -p "$(dirname "$SHADER_OUT")"
    "$QSB" --glsl "100 es,120,150" --hlsl 50 --msl 12 \
        -o "$SHADER_OUT" \
        "$SHADER_SRC"
    echo "  -> ${SHADER_OUT}"
}

install_plugin() {
    if [ ! -f "$SHADER_OUT" ]; then
        echo "ERROR: Compiled shader not found at ${SHADER_OUT}"
        echo "Run './build.sh build' first."
        exit 1
    fi

    echo "Installing wallpaper plugin..."
    # Try update first, fall back to fresh install
    if kpackagetool6 -t Plasma/Wallpaper -u "$PACKAGE_DIR" 2>/dev/null; then
        echo "  -> Updated existing installation"
    else
        kpackagetool6 -t Plasma/Wallpaper -i "$PACKAGE_DIR"
        echo "  -> Fresh install complete"
    fi

    echo ""
    echo "Done! To activate:"
    echo "  1. Right-click desktop -> Configure Desktop and Wallpaper"
    echo "  2. Select 'GL Matrix' from the wallpaper type dropdown"
    echo ""
    echo "If it doesn't appear, restart plasmashell:"
    echo "  systemctl --user restart plasma-plasmashell.service"
}

remove_plugin() {
    echo "Removing wallpaper plugin..."
    kpackagetool6 -t Plasma/Wallpaper -r "$PLUGIN_ID" 2>/dev/null \
        && echo "  -> Removed" \
        || echo "  -> Not installed"
}

case "${1:-all}" in
    build)
        build_shader
        ;;
    install)
        install_plugin
        ;;
    remove)
        remove_plugin
        ;;
    all)
        build_shader
        install_plugin
        ;;
    *)
        echo "Usage: $0 [build|install|remove|all]"
        exit 1
        ;;
esac
