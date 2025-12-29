import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { logError } from './utils.js';

/**
 * Gestión de configuración del dock usando GSettings
 */
export class DockSettings {
    constructor(settingsOrExtension = null) {
        try {
            if (settingsOrExtension && settingsOrExtension.toString().includes('Gio.Settings')) {
                // Se pasó un objeto Gio.Settings directamente
                this._settings = settingsOrExtension;
            } else if (settingsOrExtension && typeof settingsOrExtension.getSettings === 'function') {
                this._settings = settingsOrExtension.getSettings();
            } else {
                // Intentar cargar esquema manualmente desde el directorio local
                const schemaId = 'org.gnome.shell.extensions.tux-dock';

                // Navigate from core/ up to extension root, then to schemas/
                const currentDir = import.meta.url.replace('file://', '').replace('/core/settings.js', '');
                const schemaDir = GLib.build_filenamev([currentDir, 'schemas']);

                const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                    schemaDir,
                    Gio.SettingsSchemaSource.get_default(),
                    false
                );

                const schema = schemaSource.lookup(schemaId, true);
                if (schema) {
                    this._settings = new Gio.Settings({ settings_schema: schema });
                } else {
                    // Fallback a global si no se encuentra local
                    this._settings = new Gio.Settings({ schema_id: schemaId });
                }
            }
        } catch (e) {
            logError('Error initializing settings', e);
            // Fallback a valores por defecto
            this._useFallback = true;
            this._fallbackSettings = {
                iconSize: 48,
                position: 'BOTTOM',
                autohide: false,
                showRunningIndicator: true,
                showWindowCount: true,
                customOrder: [],
                magnificationEnabled: true,
                magnificationScale: 2.0,
                dockOpacity: 0.9,
                intellihide: false,
                pushWindows: false,
                minimizeToDock: true,
                showTrash: true,
                showAppLauncher: true,
                enableBounce: true,
                clickAction: 'focus-or-launch',
                scrollAction: 'cycle-windows',
                middleClickAction: 'new-window',
                dockMargin: 8,
                animationDuration: 200,
            };
        }
    }

    getSettings() {
        return this._settings;
    }

    getIconSize() {
        if (this._useFallback) return this._fallbackSettings.iconSize;
        return this._settings.get_int('icon-size');
    }

    /**
     * Get effective icon size, considering screen constraints for vertical dock
     * @param {number} numApps - Number of apps/icons to display
     * @param {number} screenHeight - Available screen height (workarea)
     */
    getEffectiveIconSize(numApps = 10, screenHeight = 800) {
        const baseSize = this.getIconSize();
        const position = this.getPosition();

        // For horizontal dock (BOTTOM), use full size
        if (position === 'BOTTOM' || position === 'TOP') {
            return baseSize;
        }

        // For vertical dock (LEFT/RIGHT), calculate max size to fit
        const padding = 20; // Top/bottom padding
        const spacing = 4; // Space between icons
        const marginForControls = 100; // Space for launcher + trash + separators

        const availableHeight = screenHeight - padding - marginForControls;
        const maxIconSize = Math.floor((availableHeight - (numApps * spacing)) / Math.max(numApps, 1));

        // Return the smaller of base size or calculated max
        return Math.min(baseSize, Math.max(32, maxIconSize));
    }

    setIconSize(size) {
        if (this._useFallback) {
            this._fallbackSettings.iconSize = Math.max(32, Math.min(96, size));
            return;
        }
        this._settings.set_int('icon-size', Math.max(32, Math.min(96, size)));
    }

    getPosition() {
        if (this._useFallback) return this._fallbackSettings.position;
        return this._settings.get_string('position');
    }

    setPosition(position) {
        if (this._useFallback) {
            if (['BOTTOM', 'LEFT', 'RIGHT'].includes(position)) {
                this._fallbackSettings.position = position;
            }
            return;
        }
        if (['BOTTOM', 'LEFT', 'RIGHT'].includes(position)) {
            this._settings.set_string('position', position);
        }
    }

    getAutohide() {
        if (this._useFallback) return this._fallbackSettings.autohide;
        return this._settings.get_boolean('autohide');
    }

    setAutohide(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.autohide = enabled;
            return;
        }
        this._settings.set_boolean('autohide', enabled);
    }

    getShowRunningIndicator() {
        if (this._useFallback) return this._fallbackSettings.showRunningIndicator;
        return this._settings.get_boolean('show-running-indicator');
    }

    getShowWindowCount() {
        if (this._useFallback) return this._fallbackSettings.showWindowCount;
        return this._settings.get_boolean('show-window-count');
    }

    getCustomOrder() {
        if (this._useFallback) return this._fallbackSettings.customOrder;
        return this._settings.get_strv('custom-order');
    }

    setCustomOrder(order) {
        if (this._useFallback) {
            this._fallbackSettings.customOrder = order;
            return;
        }
        this._settings.set_strv('custom-order', order);
    }

    saveCustomOrder(appIds) {
        if (this._useFallback) {
            this._fallbackSettings.customOrder = appIds;
            return;
        }
        this._settings.set_strv('custom-order', appIds);
    }

    getMagnificationEnabled() {
        if (this._useFallback) return this._fallbackSettings.magnificationEnabled;
        return this._settings.get_boolean('magnification-enabled');
    }

    setMagnificationEnabled(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.magnificationEnabled = enabled;
            return;
        }
        this._settings.set_boolean('magnification-enabled', enabled);
    }

    getMagnificationScale() {
        if (this._useFallback) return this._fallbackSettings.magnificationScale;
        return this._settings.get_double('magnification-scale');
    }

    setMagnificationScale(scale) {
        if (this._useFallback) {
            this._fallbackSettings.magnificationScale = Math.max(1.0, Math.min(3.0, scale));
            return;
        }
        this._settings.set_double('magnification-scale', Math.max(1.0, Math.min(3.0, scale)));
    }

    getDockOpacity() {
        if (this._useFallback) return this._fallbackSettings.dockOpacity;
        return this._settings.get_double('dock-opacity');
    }

    setDockOpacity(opacity) {
        if (this._useFallback) {
            this._fallbackSettings.dockOpacity = Math.max(0.0, Math.min(1.0, opacity));
            return;
        }
        this._settings.set_double('dock-opacity', Math.max(0.0, Math.min(1.0, opacity)));
    }

    getIntellihide() {
        if (this._useFallback) return this._fallbackSettings.intellihide;
        return this._settings.get_boolean('intellihide');
    }

    setIntellihide(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.intellihide = enabled;
            return;
        }
        this._settings.set_boolean('intellihide', enabled);
    }

    getPushWindows() {
        if (this._useFallback) return this._fallbackSettings.pushWindows;
        return this._settings.get_boolean('push-windows');
    }

    setPushWindows(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.pushWindows = enabled;
            return;
        }
        this._settings.set_boolean('push-windows', enabled);
    }

    getMinimizeToDock() {
        if (this._useFallback) return this._fallbackSettings.minimizeToDock;
        return this._settings.get_boolean('minimize-to-dock');
    }

    setMinimizeToDock(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.minimizeToDock = enabled;
            return;
        }
        this._settings.set_boolean('minimize-to-dock', enabled);
    }

    getShowTrash() {
        if (this._useFallback) return this._fallbackSettings.showTrash;
        return this._settings.get_boolean('show-trash');
    }

    setShowTrash(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.showTrash = enabled;
            return;
        }
        this._settings.set_boolean('show-trash', enabled);
    }

    getShowAppLauncher() {
        if (this._useFallback) return this._fallbackSettings.showAppLauncher;
        return this._settings.get_boolean('show-app-launcher');
    }

    setShowAppLauncher(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.showAppLauncher = enabled;
            return;
        }
        this._settings.set_boolean('show-app-launcher', enabled);
    }

    getEnableBounce() {
        if (this._useFallback) return this._fallbackSettings.enableBounce;
        return this._settings.get_boolean('enable-bounce');
    }

    setEnableBounce(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.enableBounce = enabled;
            return;
        }
        this._settings.set_boolean('enable-bounce', enabled);
    }

    getIconBackground() {
        if (this._useFallback) return this._fallbackSettings.iconBackground !== false;
        return this._settings.get_boolean('icon-background');
    }

    setIconBackground(enabled) {
        if (this._useFallback) {
            this._fallbackSettings.iconBackground = enabled;
            return;
        }
        this._settings.set_boolean('icon-background', enabled);
    }

    getClickAction() {
        if (this._useFallback) return this._fallbackSettings.clickAction;
        return this._settings.get_string('click-action');
    }

    setClickAction(action) {
        if (this._useFallback) {
            this._fallbackSettings.clickAction = action;
            return;
        }
        this._settings.set_string('click-action', action);
    }

    getScrollAction() {
        if (this._useFallback) return this._fallbackSettings.scrollAction;
        return this._settings.get_string('scroll-action');
    }

    setScrollAction(action) {
        if (this._useFallback) {
            this._fallbackSettings.scrollAction = action;
            return;
        }
        this._settings.set_string('scroll-action', action);
    }

    getMiddleClickAction() {
        if (this._useFallback) return this._fallbackSettings.middleClickAction;
        return this._settings.get_string('middle-click-action');
    }

    setMiddleClickAction(action) {
        if (this._useFallback) {
            this._fallbackSettings.middleClickAction = action;
            return;
        }
        this._settings.set_string('middle-click-action', action);
    }

    getDockMargin() {
        if (this._useFallback) return this._fallbackSettings.dockMargin;
        return this._settings.get_int('dock-margin');
    }

    setDockMargin(margin) {
        if (this._useFallback) {
            this._fallbackSettings.dockMargin = Math.max(0, Math.min(50, margin));
            return;
        }
        this._settings.set_int('dock-margin', Math.max(0, Math.min(50, margin)));
    }

    getAnimationDuration() {
        if (this._useFallback) return this._fallbackSettings.animationDuration;
        return this._settings.get_int('animation-duration');
    }

    setAnimationDuration(duration) {
        if (this._useFallback) {
            this._fallbackSettings.animationDuration = Math.max(0, Math.min(1000, duration));
            return;
        }
        this._settings.set_int('animation-duration', Math.max(0, Math.min(1000, duration)));
    }

    connect(signal, callback) {
        if (this._useFallback) return 0; // No-op en fallback
        return this._settings.connect(signal, callback);
    }

    disconnect(id) {
        if (this._useFallback || !this._settings) return;
        this._settings.disconnect(id);
    }

    // Métodos para carpetas fijadas
    getPinnedFolders() {
        if (this._useFallback) return [];
        return this._settings.get_strv('pinned-folders');
    }

    setPinnedFolders(folders) {
        if (this._useFallback) return;
        this._settings.set_strv('pinned-folders', folders);
    }

    getMinimizeAnimation() {
        if (this._useFallback) return 'scale';
        return this._settings.get_string('minimize-animation');
    }

    setMinimizeAnimation(animation) {
        if (this._useFallback) return;
        this._settings.set_string('minimize-animation', animation);
    }
}
