import Shell from 'gi://Shell';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { AppIcon } from '../icons/appIcon.js';
import { DockSettings } from '../core/settings.js';
import { AppLauncherIcon } from '../icons/launcherIcon.js';
import { TrashIcon } from '../icons/trashIcon.js';
import { DockAnimations, NotificationBouncer } from '../effects/animations.js';
import { StackIcon } from '../icons/stackIcon.js';
import { DragDropHandler } from '../services/dragDrop.js';
import { InteractiveSeparator } from '../ui/separator.js';

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
        this._separators = []; // Array de separadores interactivos
        this._dragDropHandler = new DragDropHandler(this);
        this._startingApps = new Map(); // Track apps in STARTING state (id -> Shell.App)
        this._runningAppsOrder = []; // Track order of non-favorite running apps
    }

    enable() {
        console.log('[TuxDock] AppManager.enable() iniciando...');

        // Habilitar drag & drop en el contenedor del dock
        const container = this._dockContainer.getContainer();
        if (container) {
            this._dragDropHandler.setupDropTarget(container, this);
        }

        // Set animation duration from settings
        this._animations.setDuration(this._settings.getAnimationDuration());

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

        // Detectar apps que están iniciando (STARTING state)
        this._signalIds.push(
            this._appSystem.connect('app-state-changed', (appSystem, app) => {
                const state = app.get_state();
                const appId = app.get_id();

                // Shell.AppState: STOPPED = 0, STARTING = 1, RUNNING = 2
                if (state === 1) { // STARTING
                    this._startingApps.set(appId, app);
                    console.log('[TuxDock] App iniciando:', appId);

                    // Trigger bounce animation if enabled
                    if (this._settings.getEnableBounce()) {
                        // Schedule bounce after icon is created
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                            const appIcon = this._appIcons.get(appId);
                            if (appIcon && appIcon._container) {
                                this._animations.bounceContinuous(appIcon._container, app);
                            }
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                } else {
                    // Remove from starting when RUNNING or STOPPED
                    this._startingApps.delete(appId);
                }
                this._scheduleRefresh();
            })
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
        const favoriteIds = new Set(favorites.map(app => app.get_id()));

        console.log('[TuxDock] Favoritos encontrados:', favorites.length);
        console.log('[TuxDock] Apps en ejecución:', runningApps.length);
        console.log('[TuxDock] Apps iniciando:', this._startingApps.size);

        // Update _runningAppsOrder: add new running apps, remove closed ones
        const currentRunningIds = new Set(runningApps.map(app => app.get_id()));

        // Remove apps that are no longer running from order
        this._runningAppsOrder = this._runningAppsOrder.filter(id =>
            currentRunningIds.has(id) && !favoriteIds.has(id)
        );

        // Add new running apps (not favorites) in the order they appear
        runningApps.forEach(app => {
            const id = app.get_id();
            if (!favoriteIds.has(id) && !this._runningAppsOrder.includes(id)) {
                this._runningAppsOrder.push(id);
            }
        });

        // Add starting apps that aren't in the list yet
        this._startingApps.forEach((app, id) => {
            if (!favoriteIds.has(id) && !this._runningAppsOrder.includes(id)) {
                this._runningAppsOrder.push(id);
            }
        });

        // Crear lista ordenada de apps
        const appsMap = new Map();
        const appsOrder = [];

        // Añadir favoritas en orden
        favorites.forEach(app => {
            const id = app.get_id();
            appsMap.set(id, app);
            appsOrder.push(id);
        });

        // Guardar índice donde terminan las favoritas
        this._favoritesCount = favorites.length;

        // Añadir running/starting apps en orden preservado
        this._runningAppsOrder.forEach(id => {
            const app = runningApps.find(a => a.get_id() === id) || this._startingApps.get(id);
            if (app && !appsMap.has(id)) {
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

        // Calculate effective icon size for vertical docks
        const workarea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        const numApps = appsOrder.length + (this._settings.getShowAppLauncher() ? 1 : 0) + (this._settings.getShowTrash() ? 1 : 0);
        this._effectiveIconSize = this._settings.getEffectiveIconSize(numApps, workarea.height);

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

                // Check if this is a starting app for entry animation
                const isStarting = this._startingApps.has(appId);
                this._addAppIcon(app, isStarting);
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

    _addAppIcon(app, isStarting = false) {
        const iconSize = this._effectiveIconSize || this._settings.getIconSize();
        const appIcon = new AppIcon(app, this._windowTracker, iconSize, this._settings);
        const iconActor = appIcon.build();

        // If this is a starting app, play entry animation
        if (isStarting) {
            this._animations.iconEnterNew(iconActor);
        }

        this._dockContainer.addIcon(iconActor);
        this._appIcons.set(app.get_id(), appIcon);

        // Habilitar drag and drop para reordenar
        this._dragDropHandler.makeDraggable(appIcon);
    }

    _addAppLauncher() {
        const iconSize = this._effectiveIconSize || this._settings.getIconSize();
        this._appLauncher = new AppLauncherIcon(iconSize, this._settings);
        const launcherActor = this._appLauncher.build();
        this._dockContainer.addIcon(launcherActor);
    }

    _addTrashIcon() {
        const iconSize = this._effectiveIconSize || this._settings.getIconSize();
        this._trashIcon = new TrashIcon(iconSize, this._settings);
        const trashActor = this._trashIcon.build();
        this._dockContainer.addIcon(trashActor);
    }

    _addSeparator() {
        // Crear separador interactivo
        const separator = new InteractiveSeparator(this._settings, this);
        const separatorActor = separator.build();

        this._separators.push(separator);
        this._dockContainer.addIcon(separatorActor);
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

        // Destruir separadores
        this._separators.forEach(separator => {
            if (separator) {
                separator.destroy();
            }
        });
        this._separators = [];
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
