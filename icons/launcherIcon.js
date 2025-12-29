import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { IconSize, BorderRadius, Colors, CssClass } from '../core/config.js';

/**
 * Icono especial para el lanzador de aplicaciones (App Grid)
 */
export class AppLauncherIcon {
    constructor(iconSize = IconSize.DEFAULT, settings = null) {
        this._button = null;
        this._iconSize = iconSize;
        this._icon = null;
        this._signalIds = [];
        this._settings = settings;
    }

    build() {
        this._button = new St.Button({
            style_class: `${CssClass.APP_BUTTON} ${CssClass.SPECIAL}`,
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: false,
            y_expand: false,
        });

        this._applyButtonStyle(false);

        // Aplicar clase no-background si está desactivado
        if (this._settings && !this._settings.getIconBackground()) {
            this._button.add_style_class_name('no-background');
        }

        // Crear icono de grid/lanzador
        this._icon = new St.Icon({
            icon_name: 'view-app-grid-symbolic',
            icon_size: this._iconSize,
            style_class: 'app-launcher-icon',
        });

        this._button.set_child(this._icon);

        // Conectar eventos
        this._signalIds.push(
            this._button.connect('clicked', () => {
                // Abrir el cajón de aplicaciones (App Grid)
                if (Main.overview.visible) {
                    if (Main.overview.dash.showAppsButton.checked) {
                        Main.overview.hide();
                    } else {
                        Main.overview.showApps();
                    }
                } else {
                    Main.overview.showApps();
                }
            })
        );

        // Hover effect
        this._signalIds.push(
            this._button.connect('notify::hover', (btn) => {
                this._applyButtonStyle(btn.hover);
            })
        );

        return this._button;
    }

    _applyButtonStyle(isHovered) {
        const bgColor = isHovered ? Colors.BG_ICON_HOVER : Colors.BG_ICON_NORMAL;
        this._button.set_style(`
            background-color: ${bgColor};
            border-radius: ${BorderRadius.ICON}px;
            padding: 8px;
            margin: 4px;
            transition-duration: 200ms;
        `);
    }

    getActor() {
        return this._button;
    }

    destroy() {
        // Disconnect all signals
        this._signalIds.forEach(id => {
            if (this._button) {
                try {
                    this._button.disconnect(id);
                } catch (e) {
                    // Signal already disconnected
                }
            }
        });
        this._signalIds = [];

        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }
}
