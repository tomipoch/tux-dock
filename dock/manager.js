import Shell from 'gi://Shell';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { AppIcon } from '../icons/appIcon.js';
import { DockSettings } from '../core/settings.js';
import { AppLauncherIcon } from '../icons/launcherIcon.js';
import { TrashIcon } from '../icons/trashIcon.js';
import { DockAnimations, NotificationBouncer } from '../effects/animations.js';
import { StackIcon } from '../icons/stackIcon.js';
import { DragDropHandler } from '../services/dragDrop.js';

/**
 * Gestiona las aplicaciones mostradas en el dock
 * Maneja favoritos, apps abiertas y actualización de iconos
 */
export class AppManager {
    constructor(dockContainer) {
        this._dockContainer = dockContainer;
        this._appSystem = Shell.AppSystem.get_default();
        this._windowTracker = Shell.WindowTracker.get_default();
        this._appIcons = new Map();
        this._signalIds = [];
        this._settings = new DockSettings();
        this._updateTimeout = null;
        this._appLauncher = null;
        this._trashIcon = null;
        this._animations = new DockAnimations();
        this._notificationBouncer = null;
        this._stackIcons = new Map(); // Mapa de stacks (path -> StackIcon)
        this._separator = null; // Separador entre apps fijadas y en ejecución
        this._dragDropHandler = new DragDropHandler(this);
    }

    enable() {
        console.log('[TuxDock] AppManager.enable() iniciando...');

        // Habilitar drag & drop en el contenedor del dock
        const container = this._dockContainer.getContainer();
        if (container) {
            this._dragDropHandler.setupDropTarget(container, this);
        }

        // Conectar señales para detectar cambios
        this._signalIds.push(
            this._appSystem.connect('installed-changed', () => this._scheduleRefresh())
        );
        this._signalIds.push(
            this._windowTracker.connect('tracked-windows-changed', () => this._scheduleRefresh())
        );
        this._signalIds.push(
            AppFavorites.getAppFavorites().connect('changed', () => this.refresh())
        );

        // Conectar señal para actualizar indicadores cuando cambian ventanas
        this._signalIds.push(
            global.display.connect('window-created', () => this._scheduleRefresh())
        );

        console.log('[TuxDock] Señales conectadas, llamando a refresh()...');

        // Habilitar rebote de notificaciones
        this._notificationBouncer = new NotificationBouncer(this, this._animations);
        this._notificationBouncer.enable();

        // Cargar apps iniciales
        this.refresh();

        console.log('[TuxDock] AppManager.enable() completado');
    }

    _scheduleRefresh() {
        // Evitar múltiples refreshes en corto tiempo
        if (this._updateTimeout) {
            return;
        }

        this._updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this.refresh();
            this._updateTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    refresh() {
        const favorites = AppFavorites.getAppFavorites().getFavorites();
        const runningApps = this._appSystem.get_running();

        console.log('[TuxDock] Favoritos encontrados:', favorites.length);
        console.log('[TuxDock] Apps en ejecución:', runningApps.length);

        // Crear lista ordenada de apps
        const appsMap = new Map();
        const favoriteIds = new Set();
        const appsOrder = [];

        // Añadir favoritas en orden
        favorites.forEach(app => {
            const id = app.get_id();
            appsMap.set(id, app);
            favoriteIds.add(id);
            appsOrder.push(id);
        });

        // Guardar índice donde terminan las favoritas
        this._favoritesCount = favorites.length;

        // Añadir apps en ejecución que no son favoritas
        runningApps.forEach(app => {
            const id = app.get_id();
            if (!appsMap.has(id)) {
                appsMap.set(id, app);
                appsOrder.push(id);
            }
        });

        console.log('[TuxDock] Total apps a mostrar:', appsOrder.length);

        // Verificar si hay cambios antes de recrear todo
        const currentOrder = Array.from(this._appIcons.keys());
        const needsRebuild = !this._arraysEqual(currentOrder, appsOrder);

        console.log('[TuxDock] Necesita rebuild:', needsRebuild);

        if (needsRebuild) {
            this._rebuildDock(appsMap, appsOrder);
        } else {
            // Solo actualizar estados visuales
            this._appIcons.forEach(icon => icon.updateState());
        }
    }

    _rebuildDock(appsMap, appsOrder) {
        // Limpiar iconos existentes
        this._dockContainer.clearIcons();
        this._destroyAllIcons();

        // Añadir lanzador de aplicaciones al inicio (si está habilitado)
        if (this._settings.getShowAppLauncher()) {
            this._addAppLauncher();
        }

        let addedCount = 0;

        // Crear iconos en orden
        appsOrder.forEach(appId => {
            const app = appsMap.get(appId);
            if (app) {
                // Añadir separador después de las favoritas
                if (addedCount === this._favoritesCount &&
                    addedCount > 0 &&
                    appsOrder.length > this._favoritesCount) {
                    this._addSeparator();
                }

                this._addAppIcon(app);
                addedCount++;
            }
        });

        // Añadir separador antes de papelera si hay iconos
        if (this._settings.getShowTrash() && addedCount > 0) {
            this._addSeparator();
            this._addTrashIcon();
        }

        // Actualizar posición del dock con animación
        this._dockContainer.updatePosition();
    }

    forceRebuild() {
        // Forzar reconstrucción completa del dock
        const favorites = AppFavorites.getAppFavorites().getFavorites();
        const runningApps = this._appSystem.get_running();

        const appsMap = new Map();
        const appsOrder = [];

        favorites.forEach(app => {
            const id = app.get_id();
            appsMap.set(id, app);
            appsOrder.push(id);
        });

        runningApps.forEach(app => {
            const id = app.get_id();
            if (!appsMap.has(id)) {
                appsMap.set(id, app);
                appsOrder.push(id);
            }
        });

        this._rebuildDock(appsMap, appsOrder);
    }

    _arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    _addAppIcon(app) {
        const iconSize = this._settings.getIconSize();
        const appIcon = new AppIcon(app, this._windowTracker, iconSize, this._settings);
        const iconActor = appIcon.build();

        this._dockContainer.addIcon(iconActor);
        this._appIcons.set(app.get_id(), appIcon);
    }

    _addAppLauncher() {
        const iconSize = this._settings.getIconSize();
        this._appLauncher = new AppLauncherIcon(iconSize);
        const launcherActor = this._appLauncher.build();
        this._dockContainer.addIcon(launcherActor);
    }

    _addTrashIcon() {
        const iconSize = this._settings.getIconSize();
        this._trashIcon = new TrashIcon(iconSize);
        const trashActor = this._trashIcon.build();
        this._dockContainer.addIcon(trashActor);
    }

    _addSeparator() {
        // Crear separador visual
        const position = this._settings.getPosition();
        const isHorizontal = position === 'BOTTOM';

        this._separator = new St.Widget({
            style_class: 'tux-dock-separator',
            x_expand: !isHorizontal,
            y_expand: isHorizontal,
        });

        if (isHorizontal) {
            // Dock horizontal: línea vertical
            this._separator.set_style(`
                background-color: rgba(255, 255, 255, 0.3);
                margin: 4px 8px;
                min-width: 1px;
                max-width: 1px;
            `);
        } else {
            // Dock vertical: línea horizontal
            this._separator.set_style(`
                background-color: rgba(255, 255, 255, 0.3);
                margin: 8px 4px;
                min-height: 1px;
                max-height: 1px;
            `);
        }

        this._dockContainer.addIcon(this._separator);
    }

    handleIconDrop(draggedIcon, x, y) {
        // Implementar reordenamiento después
        // Por ahora solo refrescar
        this.refresh();
    }

    _destroyAllIcons() {
        this._appIcons.forEach(icon => icon.destroy());
        this._appIcons.clear();

        if (this._appLauncher) {
            this._appLauncher.destroy();
            this._appLauncher = null;
        }

        if (this._trashIcon) {
            this._trashIcon.destroy();
            this._trashIcon = null;
        }

        if (this._separator) {
            this._separator.destroy();
            this._separator = null;
        }
    }

    disable() {
        // Deshabilitar notificaciones
        if (this._notificationBouncer) {
            this._notificationBouncer.disable();
            this._notificationBouncer = null;
        }

        // Limpiar animaciones
        if (this._animations) {
            this._animations.cleanup();
        }

        // Limpiar timeout
        if (this._updateTimeout) {
            GLib.source_remove(this._updateTimeout);
            this._updateTimeout = null;
        }

        // Desconectar señales
        this._signalIds.forEach(id => {
            try {
                this._appSystem.disconnect(id);
            } catch (e) {
                try {
                    this._windowTracker.disconnect(id);
                } catch (e2) {
                    try {
                        AppFavorites.getAppFavorites().disconnect(id);
                    } catch (e3) {
                        try {
                            global.display.disconnect(id);
                        } catch (e4) {
                            // Ignorar errores al desconectar
                        }
                    }
                }
            }
        });
        this._signalIds = [];

        // Destruir iconos
        this._destroyAllIcons();

        // Destruir stacks
        this._stackIcons.forEach(stack => stack.destroy());
        this._stackIcons.clear();
    }

    /**
     * Añadir un stack (carpeta) al dock
     */
    addStack(stackPath, stackName) {
        if (this._stackIcons.has(stackPath)) {
            return; // Ya existe
        }

        const stackIcon = new StackIcon(stackPath, stackName);
        this._stackIcons.set(stackPath, stackIcon);

        // Añadir al contenedor
        const container = this._dockContainer.getIconsContainer();
        if (container) {
            container.add_child(stackIcon.actor);
        }
    }

    /**
     * Eliminar un stack del dock
     */
    removeStack(stackPath) {
        const stackIcon = this._stackIcons.get(stackPath);
        if (stackIcon) {
            stackIcon.destroy();
            this._stackIcons.delete(stackPath);
        }
    }

    /**
     * Obtener todos los stacks
     */
    getStacks() {
        return Array.from(this._stackIcons.keys());
    }
}
