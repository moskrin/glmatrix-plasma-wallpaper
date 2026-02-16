// GL Matrix - KDE Plasma 6 wallpaper plugin
// Based on glmatrix from xscreensaver by Jamie Zawinski <jwz@jwz.org>
// See LICENSE for full copyright and permission notice.

import QtQuick
import org.kde.plasma.plasmoid

WallpaperItem {
    id: root
    anchors.fill: parent

    // -- Camera rotation state machine (ported from xscreensaver auto_track) --

    readonly property var niceViews: [
        { x:   0, y:   0 },
        { x:   0, y: -20 },
        { x:   0, y:  20 },
        { x:  25, y:   0 },
        { x: -25, y:   0 },
        { x:  25, y:  20 },
        { x: -25, y:  20 },
        { x:  25, y: -20 },
        { x: -25, y: -20 },
        { x:  10, y:   0 },
        { x: -10, y:   0 },
        { x:   0, y:   0 },
        { x:   0, y:   0 },
        { x:   0, y:   0 },
        { x:   0, y:   0 },
        { x:   0, y:   0 }
    ]

    property int lastView: 0
    property int targetView: 0
    property real viewX: 0
    property real viewY: 0
    property int viewSteps: 100
    property int viewTick: 0
    property bool autoTracking: false
    property int trackTick: 0

    function modeToIndex(modeStr) {
        if (modeStr === "binary") return 1;
        if (modeStr === "hexadecimal") return 2;
        if (modeStr === "decimal") return 3;
        if (modeStr === "dna") return 4;
        return 0;
    }

    function updateCameraRotation() {
        var cfg = root.configuration;
        var spd = cfg.speed || 1.0;
        var doRotate = cfg.rotate;

        if (!doRotate) {
            viewX = 0;
            viewY = 0;
            return;
        }

        if (!autoTracking) {
            trackTick++;
            if (trackTick < Math.floor(10 / spd)) return;
            trackTick = 0;
            if (Math.random() < 0.15) {
                autoTracking = true;
            }
            return;
        }

        var ox = niceViews[lastView].x;
        var oy = niceViews[lastView].y;
        var tx = niceViews[targetView].x;
        var ty = niceViews[targetView].y;

        var th = Math.sin((Math.PI / 2.0) * viewTick / viewSteps);

        viewX = ox + (tx - ox) * th;
        viewY = oy + (ty - oy) * th;
        viewTick++;

        if (viewTick >= viewSteps) {
            viewTick = 0;
            viewSteps = Math.floor(200.0 / spd);
            lastView = targetView;
            targetView = Math.floor(Math.random() * (niceViews.length - 1)) + 1;
            autoTracking = false;
        }
    }

    // -- Glyph atlas texture --
    Image {
        id: atlasImage
        source: Qt.resolvedUrl("Resources/matrix3.png")
        visible: false
    }

    // -- The shader effect --
    ShaderEffect {
        id: shader
        anchors.fill: parent

        property real iTime: 0
        property vector4d iResolution: Qt.vector4d(root.width, root.height, 0, 0)
        property real speed: root.configuration.speed || 1.0
        property real density: root.configuration.density || 20
        property int mode: modeToIndex(root.configuration.mode)
        property int fogEnabled: root.configuration.fog ? 1 : 0
        property int wavesEnabled: root.configuration.waves ? 1 : 0
        property real rotateX: root.viewX
        property real rotateY: root.viewY
        property var glyphAtlas: atlasImage

        fragmentShader: Qt.resolvedUrl("Shaders6/glmatrix.frag.qsb")

        NumberAnimation on iTime {
            from: 0
            to: 360000
            duration: 360000000
            loops: Animation.Infinite
            running: true
        }
    }

    // Camera rotation timer (separate from shader animation)
    Timer {
        interval: 16
        repeat: true
        running: true
        onTriggered: updateCameraRotation()
    }

    onWidthChanged: shader.iResolution = Qt.vector4d(root.width, root.height, 0, 0)
    onHeightChanged: shader.iResolution = Qt.vector4d(root.width, root.height, 0, 0)
}
