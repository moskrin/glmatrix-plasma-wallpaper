import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: root
    twinFormLayouts: parentLayout
    property alias formLayout: root

    // cfg_ properties auto-bind to KConfig entries in main.xml
    property alias cfg_speed: speedSlider.value
    property alias cfg_density: densitySlider.value
    property string cfg_mode: wallpaper.configuration.mode || "matrix"
    property alias cfg_fog: fogCheck.checked
    property alias cfg_waves: wavesCheck.checked
    property alias cfg_rotate: rotateCheck.checked
    property alias cfg_fps: fpsSlider.value

    // -- Speed --
    RowLayout {
        Kirigami.FormData.label: "Speed:"

        Slider {
            id: speedSlider
            Layout.preferredWidth: Kirigami.Units.gridUnit * 14
            from: 0.1
            to: 5.0
            stepSize: 0.1
            value: wallpaper.configuration.speed || 1.0
        }

        Label {
            text: speedSlider.value.toFixed(1) + "x"
            Layout.preferredWidth: Kirigami.Units.gridUnit * 3
        }
    }

    // -- Density --
    RowLayout {
        Kirigami.FormData.label: "Density:"

        Slider {
            id: densitySlider
            Layout.preferredWidth: Kirigami.Units.gridUnit * 14
            from: 1
            to: 100
            stepSize: 1
            value: wallpaper.configuration.density || 20
        }

        Label {
            text: Math.round(densitySlider.value) + "%"
            Layout.preferredWidth: Kirigami.Units.gridUnit * 3
        }
    }

    // -- Encoding Mode --
    ComboBox {
        id: modeCombo
        Kirigami.FormData.label: "Encoding:"

        model: [
            { text: "Matrix",      value: "matrix" },
            { text: "Binary",      value: "binary" },
            { text: "Hexadecimal", value: "hexadecimal" },
            { text: "Decimal",     value: "decimal" },
            { text: "DNA",         value: "dna" }
        ]

        textRole: "text"
        valueRole: "value"

        Component.onCompleted: {
            var current = wallpaper.configuration.mode || "matrix";
            for (var i = 0; i < model.length; i++) {
                if (model[i].value === current) {
                    currentIndex = i;
                    break;
                }
            }
        }

        onActivated: {
            cfg_mode = model[currentIndex].value;
        }
    }

    // -- Effects --
    CheckBox {
        id: fogCheck
        Kirigami.FormData.label: "Effects:"
        text: "Fog (depth dimming)"
        checked: wallpaper.configuration.fog !== undefined ? wallpaper.configuration.fog : true
    }

    CheckBox {
        id: wavesCheck
        text: "Brightness waves"
        checked: wallpaper.configuration.waves !== undefined ? wallpaper.configuration.waves : true
    }

    CheckBox {
        id: rotateCheck
        text: "Camera panning"
        checked: wallpaper.configuration.rotate !== undefined ? wallpaper.configuration.rotate : true
    }

    // -- FPS --
    RowLayout {
        Kirigami.FormData.label: "Frame rate:"

        Slider {
            id: fpsSlider
            Layout.preferredWidth: Kirigami.Units.gridUnit * 14
            from: 15
            to: 120
            stepSize: 1
            value: wallpaper.configuration.fps || 60
        }

        Label {
            text: Math.round(fpsSlider.value) + " fps"
            Layout.preferredWidth: Kirigami.Units.gridUnit * 4
        }
    }
}
