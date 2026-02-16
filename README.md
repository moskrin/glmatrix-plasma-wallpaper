# GL Matrix

A KDE Plasma 6 wallpaper plugin port of xscreensaver's glmatrix.
Ported from Jamie Zawinski's
[glmatrix](https://www.jwz.org/xscreensaver/screenshots/) screensaver in
[xscreensaver](https://www.jwz.org/xscreensaver/).

The original glmatrix is ~1077 lines of C using legacy OpenGL immediate mode.
This port reimplements the effect as a single GPU fragment shader running inside
a QML ShaderEffect - no C++ compilation required. The shader uses hash-based
procedural randomness to generate the entire scene (strip speeds, glyph
selection, wave phases, depth layers) without any CPU-side state.


## Features

- Multiple depth layers with perspective scaling and fog
- Falling glyph strips with bright "spinner" at the leading edge
- Rolling brightness waves
- Camera panning with depth-dependent parallax
- Resolution-aware scaling (looks correct on both 1080p and 4K)
- Five encoding modes: Matrix, Binary, Hexadecimal, Decimal, DNA
- Configurable speed, density, fog, waves, and camera panning


## Requirements

- KDE Plasma 6 (Wayland or X11)
- Qt 6 Shader Baker (`qsb`) for compiling the fragment shader

Install the shader compiler for your distro:

```
# Debian / Ubuntu
sudo apt install qt6-shader-baker

# Arch
sudo pacman -S qt6-shadertools

# Fedora
sudo dnf install qt6-qtshadertools
```


## Install

```bash
git clone https://github.com/your-username/kmatrix.git
cd kmatrix
./build.sh
```

This compiles the shader and installs the wallpaper plugin. To activate it:

1. Right-click your desktop and select "Configure Desktop and Wallpaper"
2. In the "Wallpaper Type" dropdown, select "GL Matrix"

If it doesn't appear in the list, restart plasmashell:

```bash
systemctl --user restart plasma-plasmashell.service
```


## Uninstall

```bash
./build.sh remove
```


## Configuration

Right-click the desktop, choose "Configure Desktop and Wallpaper", and select
"GL Matrix". The settings panel includes:

| Setting | Default | Description |
|---------|---------|-------------|
| Speed | 1.0 | Animation speed multiplier (0.1 - 5.0) |
| Density | 20 | How many glyph strips are active (1 - 100) |
| Mode | Matrix | Glyph encoding: Matrix, Binary, Hex, Decimal, DNA |
| Fog | On | Depth-based dimming (farther layers are darker) |
| Waves | On | Rolling brightness variation across strips |
| Camera Panning | On | Slow parallax camera movement between preset angles |
| FPS | 60 | Target frame rate (15 - 120) |


## How It Works

The entire effect runs in a single fragment shader (`glmatrix.frag`). For each
pixel on screen:

1. Eight depth layers are evaluated, from farthest to nearest
2. Each layer has a grid of cells scaled by perspective (closer = larger)
3. Per-column properties (speed, offset, wave phase) are derived from hash
   functions seeded by column index and layer number
4. Each column runs a draw/erase/gap cycle - the "spinner" drops from top to
   bottom revealing glyphs, then an erase wave follows
5. Glyphs are sampled from the xscreensaver `matrix3.png` texture atlas
   (16x13 grid of characters)
6. Brightness is modulated by fog (depth), waves (rolling sin curve), and
   splash fade (closest layer fade-out)
7. Layers are composited with additive blending, matching the original's
   `glBlendFunc(GL_SRC_ALPHA, GL_ONE)`

Camera panning is handled in QML - a state machine interpolates between preset
viewing angles using sinusoidal easing, and the shader applies the rotation as
per-layer parallax translation (closer layers shift more).


## File Structure

```
kmatrix/
  package/
    metadata.json                          # Plugin descriptor
    contents/
      config/
        main.xml                           # KConfig schema
      ui/
        main.qml                           # WallpaperItem + ShaderEffect
        config.qml                         # Settings panel
        Shaders/
          glmatrix.frag                    # GLSL 450 source
        Shaders6/
          glmatrix.frag.qsb               # Compiled shader (generated)
        Resources/
          matrix3.png                      # Glyph atlas from xscreensaver
  build.sh                                # Compile + install
  LICENSE
  README.md
```


## Credits

The original [glmatrix](https://www.jwz.org/xscreensaver/screenshots/)
screensaver was written by [Jamie Zawinski](https://www.jwz.org/) as part of
[xscreensaver](https://www.jwz.org/xscreensaver/), which he has maintained
since 1992. The glyph texture atlas (`matrix3.png`) is from xscreensaver.

This port would not exist without his work. See [LICENSE](LICENSE) for full
copyright and permission notices.


## License

MIT/X11 - see [LICENSE](LICENSE) for details.
