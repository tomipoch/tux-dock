import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Icono especial para el lanzador de aplicaciones (App Grid)
 */
export class AppLauncherIcon {
    constructor(iconSize = 48) {
        this._button = null;
        this._iconSize = iconSize;
    }

    build() {
        this._button = new St.Button({
            style_class: 'tux-dock-app-button tux-dock-special',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: false,
            y_expand: false,
        });

        this._button.set_style(`
            padding: 6px;
            margin: 0 2px;
            border-radius: 12px;
            transition-duration: 200ms;
        `);

        // Crear icono de grid/lanzador
        const icon = new St.Icon({
            icon_name: 'view-app-grid-symbolic',
            icon_size: this._iconSize,
            style_class: 'app-launcher-icon',
        });

        this._button.set_child(icon);

        // Conectar eventos
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
        });

        // Hover effect
        this._button.connect('notify::hover', (btn) => {
            if (btn.hover) {
                btn.set_style(btn.get_style() + `
                    background-color: rgba(255, 255, 255, 0.25);
                    transform: scale(1.1);
                `);
            } else {
                btn.set_style(`
                    padding: 6px;
                    margin: 0 2px;
                    border-radius: 12px;
                    transition-duration: 200ms;
                `);
            }
        });

        return this._button;
    }

    getActor() {
        return this._button;
    }

    destroy() {
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }
}

/**
 * Icono especial para la papelera
 */
export class TrashIcon {
    constructor(iconSize = 48) {
        this._button = null;
        this._iconSize = iconSize;
        this._trashMonitor = null;
    }

    build() {
        this._button = new St.Button({
            style_class: 'tux-dock-app-button tux-dock-special',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: false,
            y_expand: false,
        });

        this._button.set_style(`
            padding: 6px;
            margin: 0 2px;
            border-radius: 12px;
            transition-duration: 200ms;
        `);

        // Crear icono de papelera
        this._icon = new St.Icon({
            icon_size: this._iconSize,
            style_class: 'trash-icon',
        });

        this._button.set_child(this._icon);

        // Monitorear estado de la papelera
        this._updateTrashIcon();
        this._setupTrashMonitor();

        // Conectar eventos
        this._button.connect('clicked', () => {
            // Abrir papelera en el gestor de archivos
            try {
                Gio.AppInfo.launch_default_for_uri('trash:///', null);
            } catch (e) {
                console.error('Error al abrir papelera:', e);
            }
        });

        // Hover effect
        this._button.connect('notify::hover', (btn) => {
            if (btn.hover) {
                btn.set_style(btn.get_style() + `
                    background-color: rgba(255, 255, 255, 0.25);
                    transform: scale(1.1);
                `);
            } else {
                btn.set_style(`
                    padding: 6px;
                    margin: 0 2px;
                    border-radius: 12px;
                    transition-duration: 200ms;
                `);
            }
        });

        return this._button;
    }

    _setupTrashMonitor() {
        // Monitorear cambios en la papelera
        const trashFile = Gio.File.new_for_uri('trash:///');
        try {
            this._trashMonitor = trashFile.monitor(Gio.FileMonitorFlags.NONE, null);
            this._trashMonitor.connect('changed', () => {
                this._updateTrashIcon();
            });
        } catch (e) {
            console.error('Error al monitorear papelera:', e);
        }
    }

    _updateTrashIcon() {
        if (!this._icon) return;

        // Verificar si la papelera está vacía o llena
        const trashFile = Gio.File.new_for_uri('trash:///');
        try {
            const enumerator = trashFile.enumerate_children(
                'standard::*',
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            
            const hasItems = enumerator.next_file(null) !== null;
            enumerator.close(null);
            
            // Usar iconos no simbólicos (coloridos) para mejor visualización
            this._icon.icon_name = hasItems ? 'user-trash-full' : 'user-trash';
        } catch (e) {
            // Si hay error, asumir vacía
            this._icon.icon_name = 'user-trash';
        }
    }

    getActor() {
        return this._button;
    }

    destroy() {
        if (this._trashMonitor) {
            this._trashMonitor.cancel();
            this._trashMonitor = null;
        }
        
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
        
        this._icon = null;
    }
}
