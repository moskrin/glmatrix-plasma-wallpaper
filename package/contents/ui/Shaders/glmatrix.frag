#version 450

// GL Matrix - 3D digital rain fragment shader for KDE Plasma 6
//
// Based on glmatrix from xscreensaver by Jamie Zawinski <jwz@jwz.org>
// Original: Copyright (c) 2003-2018 Jamie Zawinski
// https://www.jwz.org/xscreensaver/
//
// Permission to use, copy, modify, distribute, and sell this software and its
// documentation for any purpose is hereby granted without fee, provided that
// the above copyright notice appear in all copies and that both that
// copyright notice and this permission notice appear in supporting
// documentation.  No representations are made about the suitability of this
// software for any purpose.  It is provided "as is" without express or
// implied warranty.
//
// This is a clean reimplementation as a GPU fragment shader. The original
// used legacy OpenGL immediate mode (glBegin/glEnd) with CPU-side per-strip
// state arrays. This version renders the same effect procedurally using
// hash-based randomness across multiple depth layers, requiring no CPU state.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float iTime;
    vec4 iResolution;
    float speed;
    float density;
    int mode;
    int fogEnabled;
    int wavesEnabled;
    float rotateX;
    float rotateY;
} ubuf;

layout(binding = 1) uniform sampler2D glyphAtlas;

// -- Constants matching the original xscreensaver glmatrix --

const int CHAR_COLS = 16;
const int CHAR_ROWS = 13;
const int NUM_LAYERS = 8;
const float CELL_ASPECT = 46.0 / 32.0;    // glyph height / width from atlas
const int WAVE_SIZE = 22;
const float SPLASH_RATIO = 0.7;

// -- Hash functions for procedural randomness --

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

// Bell-curve-ish random (average of 3 randoms, like the original's BELLRAND)
float bellrand(float seed, float range) {
    float a = hash11(seed * 7.13);
    float b = hash11(seed * 13.71);
    float c = hash11(seed * 31.37);
    return (a + b + c) / 3.0 * range;
}

// -- Glyph encoding selection --
// Returns a glyph index (0-207) based on mode and a hash value [0,1)

int getGlyphIndex(float h, int encMode) {
    if (encMode == 1) {
        // Binary: glyphs 16, 17 (digits 0, 1)
        return 16 + int(h * 2.0);
    } else if (encMode == 2) {
        // Hexadecimal: 0-9 (16-25), A-F (33-38)
        int idx = int(h * 16.0);
        if (idx < 10) return 16 + idx;
        return 33 + (idx - 10);
    } else if (encMode == 3) {
        // Decimal: 0-9 (16-25)
        return 16 + int(h * 10.0);
    } else if (encMode == 4) {
        // DNA: A(33), C(35), G(39), T(52)
        int idx = int(h * 4.0);
        if (idx == 0) return 33;
        if (idx == 1) return 35;
        if (idx == 2) return 39;
        return 52;
    }
    // Matrix mode (0): digits (16-25) + katakana-esque (160-175)
    int idx = int(h * 26.0);
    if (idx < 10) return 16 + idx;
    return 160 + (idx - 10);
}

// -- Glyph atlas UV lookup --
// Given a glyph index and the fractional position within the cell,
// return the UV to sample from the atlas texture.

vec2 glyphUV(int glyphIdx, vec2 cellFrac, bool flipH) {
    int col = glyphIdx % CHAR_COLS;
    int row = glyphIdx / CHAR_COLS;

    // Flip horizontally for matrix mode (original does this)
    float fx = flipH ? (1.0 - cellFrac.x) : cellFrac.x;
    // No Y flip needed: Qt tex coords and atlas both have origin at top-left
    float fy = cellFrac.y;

    float u = (float(col) + fx) / float(CHAR_COLS);
    float v = (float(row) + fy) / float(CHAR_ROWS);
    return vec2(u, v);
}

// -- Brightness ramp (matches original's sin-based curve) --

float brightnessRamp(int i) {
    float j = float(WAVE_SIZE - i) / float(WAVE_SIZE - 1);
    j *= 3.14159265 / 2.0;
    j = sin(j);
    return 0.2 + j * 0.8;
}

// -- Main --

void main() {
    vec2 uv = qt_TexCoord0;
    // Qt tex coords: (0,0) = top-left, (1,1) = bottom-right
    // This is correct for our rain: row 0 at top, increasing downward

    // Aspect ratio correction
    float aspect = ubuf.iResolution.x / ubuf.iResolution.y;

    // Camera rotation angles (applied per-layer as parallax below)
    float rx = ubuf.rotateX * 3.14159265 / 180.0;
    float ry = ubuf.rotateY * 3.14159265 / 180.0;

    // Accumulate color across all depth layers
    vec3 color = vec3(0.0);
    float time = ubuf.iTime * ubuf.speed;
    bool flipH = (ubuf.mode == 0); // matrix mode flips glyphs

    for (int layer = 0; layer < NUM_LAYERS; layer++) {
        // Depth factor: layer 0 is farthest, NUM_LAYERS-1 is closest
        float depth = float(layer) / float(NUM_LAYERS - 1);
        float layerDepth = 0.3 + depth * 0.7;  // range [0.3, 1.0]

        // Scale factor simulates perspective (closer = larger cells)
        float scale = 0.5 + depth * 1.0;  // range [0.5, 1.5]

        // Number of columns visible at this depth
        // Base of 25 targets ~67 cols at 1080p 16:9 (original uses 70)
        // Scale with resolution so 4K doesn't look zoomed in
        float resScale = max(1.0, ubuf.iResolution.x / 1920.0);
        float numCols = floor(25.0 * scale * aspect * resScale);
        // Compute rows to fill screen while preserving glyph aspect ratio
        // cellHeight/cellWidth = CELL_ASPECT, so numRows = numCols / (aspect * CELL_ASPECT)
        float numRows = max(8.0, floor(numCols / (aspect * CELL_ASPECT)));

        // Layer-specific UV with scale
        vec2 layerUV = uv;
        // Offset each layer slightly so columns don't perfectly align
        float layerOffsetX = hash11(float(layer) * 73.17) * 0.5;
        float layerOffsetY = hash11(float(layer) * 91.31) * 0.3;
        layerUV.x = (layerUV.x - 0.5) * numCols + numCols * 0.5 + layerOffsetX;
        layerUV.y = (layerUV.y - 0.5) * numRows + numRows * 0.5 + layerOffsetY;

        // Camera rotation as depth-dependent parallax shift
        // Closer layers shift more, like the original's glRotatef on 3D geometry
        layerUV.x += tan(ry) * layerDepth * numCols * 0.4;
        layerUV.y += tan(rx) * layerDepth * numRows * 0.4;

        // Wrap vertically so panning reveals infinite rain, not blank edges
        layerUV.y = mod(layerUV.y, numRows);

        // Which cell are we in?
        float col = floor(layerUV.x);
        float row = floor(layerUV.y);

        // Fractional position within cell (for glyph texture lookup)
        vec2 cellFrac = fract(layerUV);

        // Column hash seed
        float colSeed = col * 127.1 + float(layer) * 311.7;

        // Is this column active? (density control)
        float colActive = hash11(colSeed + 0.5);
        // Scale so density=20 gives ~44 total active strips (matching original)
        float densityThreshold = ubuf.density / (100.0 * float(NUM_LAYERS) * 0.15);
        if (colActive > densityThreshold) continue;

        // Strip properties derived from column hash
        // Original: BELLRAND(0.3) * speed rows/frame at ~33fps = ~5 rows/sec avg
        float stripSpeed = 3.0 + bellrand(colSeed + 1.0, 7.0);
        float stripOffset = hash11(colSeed + 2.0) * 200.0;
        float waveSpeed = 3.0 + bellrand(colSeed + 3.0, 6.0);
        float wavePhase = hash11(colSeed + 4.0) * float(WAVE_SIZE);
        float eraseSpeedRatio = 0.5; // erase at half speed, like original

        // Strip cycle: draw phase + erase phase + gap
        float drawLength = numRows;
        float eraseLength = numRows / eraseSpeedRatio;
        float gapLength = 2.0 + hash11(colSeed + 5.0) * 15.0;
        float cycleLength = drawLength + eraseLength + gapLength;

        float cyclePos = mod(time * stripSpeed + stripOffset, cycleLength);

        // Determine visibility of this row
        float spinnerY;
        bool visible = false;
        bool isSpinner = false;
        bool erasing = false;

        if (cyclePos < drawLength) {
            // Drawing phase: spinner drops from top, revealing glyphs behind
            spinnerY = cyclePos;
            visible = (row >= 0.0 && row <= spinnerY && row < numRows);
            isSpinner = (abs(row - floor(spinnerY)) < 1.0);
        } else if (cyclePos < drawLength + eraseLength) {
            // Erasing phase: erase line drops from top, hiding glyphs
            erasing = true;
            float erasePos = (cyclePos - drawLength) * eraseSpeedRatio;
            spinnerY = erasePos;
            visible = (row >= 0.0 && row > erasePos && row < numRows);
            isSpinner = false;
        }
        // else: gap phase, nothing visible

        if (!visible) continue;

        // Glyph selection
        float glyphHash;
        int glyphIdx;

        if (isSpinner) {
            // Spinner glyph cycles rapidly
            glyphHash = hash31(vec3(col, float(layer), floor(time * 8.0)));
            glyphIdx = getGlyphIndex(glyphHash, ubuf.mode);
        } else {
            // Static glyph (but some spin occasionally)
            float spinChance = hash21(vec2(col * 17.3 + row * 31.7, float(layer)));
            if (spinChance < 0.05) {
                // Spinning glyph: changes periodically
                float spinRate = 2.0 + hash21(vec2(col, row + float(layer) * 100.0)) * 4.0;
                glyphHash = hash31(vec3(col, row, floor(time * spinRate) + float(layer)));
            } else {
                // Fixed glyph (changes only when strip resets)
                float cycle = floor((time * stripSpeed + stripOffset) / cycleLength);
                glyphHash = hash31(vec3(col, row, cycle + float(layer) * 7.0));
            }
            glyphIdx = getGlyphIndex(glyphHash, ubuf.mode);

            // Some cells are empty (~1 in 7, matching original's random() % 7)
            float drawChance = hash21(vec2(col * 43.7 + float(layer) * 13.0, row * 67.3));
            if (drawChance < 0.143) continue;
        }

        // Sample the glyph from the atlas
        vec2 atlasUV = glyphUV(glyphIdx, cellFrac, flipH);
        vec4 texel = texture(glyphAtlas, atlasUV);

        // The original processes the texture: alpha = green channel
        float glyphShape = texel.g;

        // Skip transparent areas (background of glyph)
        if (glyphShape < 0.05) continue;

        // Compute brightness
        float brightness = 1.0;

        // Fog: dimmer with distance
        if (ubuf.fogEnabled != 0) {
            float fogFactor = 0.2 + layerDepth * 0.8;
            brightness *= fogFactor;
        }

        // Waves: rolling brightness variation
        if (ubuf.wavesEnabled != 0) {
            float wavePos = mod(time * waveSpeed + wavePhase, float(WAVE_SIZE));
            int waveIdx = int(mod(row + numRows - wavePos, float(WAVE_SIZE)));
            waveIdx = WAVE_SIZE - 1 - waveIdx;
            if (waveIdx < 0) waveIdx = 0;
            if (waveIdx >= WAVE_SIZE) waveIdx = WAVE_SIZE - 1;
            brightness *= brightnessRamp(waveIdx);
        }

        // Spinner glyph is brighter
        if (isSpinner) {
            brightness *= 1.5;
        }

        // Splash fade: glyphs near the "screen" (closest layer) fade out
        if (depth > 0.7) {
            float fadeRatio = (depth - 0.7) / 0.3;
            int fadeIdx = int(fadeRatio * float(WAVE_SIZE));
            fadeIdx = clamp(fadeIdx, 0, WAVE_SIZE - 1);
            brightness *= brightnessRamp(fadeIdx);
        }

        // Accumulate (additive blending across layers)
        // Original uses green-on-black with glBlendFunc(GL_SRC_ALPHA, GL_ONE)
        float alpha = glyphShape * brightness;
        color.g += alpha;
        // Add subtle color tint for highlights and depth
        color.r += alpha * 0.05;
        color.b += alpha * 0.05;
    }

    // Clamp to avoid oversaturation
    color = min(color, vec3(1.0));

    fragColor = vec4(color, 1.0) * ubuf.qt_Opacity;
}
