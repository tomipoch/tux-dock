import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { DockContainer } from './dock/container.js';
import { AppManager } from './dock/manager.js';
import { DockSettings } from './core/settings.js';
import { AutohideManager } from './dock/autohide.js';
import { MinimizeToIcon } from './services/minimize.js';
import { log, logError } from './core/utils.js';

/**
 * Clase principal de la extensión TuxDock
 * Coordina todos los componentes del dock
 */
class TuxDock {
    constructor(extensionObject) {
        this._extensionObject = extensionObject;
        this._dockContainer = null;
        this._appManager = null;
        this._autohideManager = null;
        this._minimizeManager = null;
        this._monitorChangedId = null;
        this._settings = null;
        this._settingsChangedIds = [];
        this._originalDashVisible = undefined;
    }

    enable() {
        try {
            console.log('[TuxDock] === INICIANDO EXTENSIÓN ===');
            log('Habilitando TuxDock...');

            // Inicializar configuración
            console.log('[TuxDock] Creando settings...');
            const settings = this._extensionObject.getSettings();
            this._settings = new DockSettings(settings);

            // Crear contenedor del dock
            console.log('[TuxDock] Creando contenedor...');
            this._dockContainer = new DockContainer(this._settings);
            const container = this._dockContainer.build();
            console.log('[TuxDock] Contenedor creado:', container !== null);

            // Crear gestor de aplicaciones
            console.log('[TuxDock] Creando app manager...');
            this._appManager = new AppManager(this._dockContainer);
            this._appManager.enable();
            console.log('[TuxDock] App manager habilitado');

            // Inicializar autohide
            console.log('[TuxDock] Inicializando autohide...');
            this._autohideManager = new AutohideManager(this._dockContainer, this._settings);
            this._autohideManager.enable();

            // Inicializar minimizar al icono
            console.log('[TuxDock] Inicializando minimizar al icono...');
            this._minimizeManager = new MinimizeToIcon(this._dockContainer, this._appManager, this._settings);
            this._minimizeManager.enable();

            // Conectar al cambio de tamaño del monitor
            this._monitorChangedId = Main.layoutManager.connect('monitors-changed', () => {
                this._dockContainer.updatePosition();
            });

            // Ocultar el dash de GNOME en overview
            this._hideDash();

            // Escuchar cambios en la configuración
            this._connectSettings();

            // Actualizar posición inicial después de un delay para asegurar que todo está renderizado
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                if (this._dockContainer) {
                    this._dockContainer.updatePosition();
                }
                return GLib.SOURCE_REMOVE;
            });

            console.log('[TuxDock] === EXTENSIÓN HABILITADA ===');
            log('TuxDock habilitado correctamente');
        } catch (e) {
            console.error('[TuxDock] ERROR EN ENABLE:', e);
            logError('Error al habilitar TuxDock', e);
        }
    }

    _connectSettings() {
        const settings = this._settings.getSettings();
        log('[TuxDock] === CONECTANDO SETTINGS ===');
        log(`[TuxDock] Settings object: ${settings ? 'OK' : 'NULL'}`);

        // Escuchar cambios en autohide
        this._settingsChangedIds.push(
            settings.connect('changed::autohide', () => {
                const enabled = this._settings.getAutohide();
                if (this._autohideManager) {
                    this._autohideManager.setAutohide(enabled);
                }
            })
        );

        // Escuchar cambios en intellihide
        this._settingsChangedIds.push(
            settings.connect('changed::intellihide', () => {
                const enabled = this._settings.getIntellihide();
                if (this._autohideManager) {
                    this._autohideManager.setIntellihide(enabled);
                }
            })
        );

        // Escuchar cambios en magnificación
        this._settingsChangedIds.push(
            settings.connect('changed::magnification-enabled', () => {
                const enabled = this._settings.getMagnificationEnabled();
                log(`[TuxDock] *** MAGNIFICACIÓN CAMBIADA A: ${enabled} ***`);
                if (this._dockContainer) {
                    this._dockContainer.updateMagnification();
                }
            })
        );

        this._settingsChangedIds.push(
            settings.connect('changed::magnification-scale', () => {
                if (this._dockContainer) {
                    this._dockContainer.updateMagnification();
                }
            })
        );

        // Escuchar cambios en tamaño de iconos - actualización instantánea
        this._settingsChangedIds.push(
            settings.connect('changed::icon-size', () => {
                const newSize = this._settings.getIconSize();
                log(`[TuxDock] *** TAMAÑO CAMBIADO A: ${newSize} ***`);
                log('Tamaño de iconos cambiado, aplicando...');
                if (this._dockContainer && this._appManager) {
                    // Actualizar el tamaño en cada icono existente
                    const newSize = this._settings.getIconSize();
                    this._appManager._appIcons.forEach(appIcon => {
                        if (appIcon._icon && appIcon._icon.set_icon_size) {
                            appIcon._icon.set_icon_size(newSize);
                            appIcon._iconSize = newSize;
                        }
                    });

                    // Actualizar iconos especiales
                    if (this._appManager._appLauncher && this._appManager._appLauncher._icon) {
                        this._appManager._appLauncher._icon.set_icon_size(newSize);
                    }
                    if (this._appManager._trashIcon && this._appManager._trashIcon._icon) {
                        this._appManager._trashIcon._icon.set_icon_size(newSize);
                    }

                    this._dockContainer.updatePosition();
                }
            })
        );

        // Escuchar cambios en posición - requiere reconstruir dock
        this._settingsChangedIds.push(
            settings.connect('changed::position', () => {
                log('Posición cambiada, reconstruyendo dock...');
                if (this._appManager) {
                    this._appManager.forceRebuild();
                }
                if (this._dockContainer) {
                    this._dockContainer.updatePosition();
                }
            })
        );

        // Escuchar cambios en opacidad
        this._settingsChangedIds.push(
            settings.connect('changed::dock-opacity', () => {
                if (this._dockContainer) {
                    this._dockContainer.updateStyle();
                }
            })
        );

        // Escuchar cambios en margen
        this._settingsChangedIds.push(
            settings.connect('changed::dock-margin', () => {
                if (this._dockContainer) {
                    this._dockContainer.updateStyle();
                    this._dockContainer.updatePosition();
                }
            })
        );

        // Escuchar cambios en minimize-to-dock
        this._settingsChangedIds.push(
            settings.connect('changed::minimize-to-dock', () => {
                const enabled = this._settings.getMinimizeToDock();
                if (this._minimizeManager) {
                    this._minimizeManager.setEnabled(enabled);
                }
            })
        );

        // Escuchar cambios en iconos especiales (requiere reconstruir)
        this._settingsChangedIds.push(
            settings.connect('changed::show-trash', () => {
                log('Configuración de papelera cambiada, reconstruyendo...');
                this._appManager.forceRebuild();
            })
        );

        this._settingsChangedIds.push(
            settings.connect('changed::show-app-launcher', () => {
                log('Configuración de lanzador de apps cambiada, reconstruyendo...');
                this._appManager.forceRebuild();
            })
        );

        // Escuchar cambios en indicadores (requiere refrescar)
        this._settingsChangedIds.push(
            settings.connect('changed::show-running-indicator', () => {
                this._appManager.refresh();
            })
        );

        this._settingsChangedIds.push(
            settings.connect('changed::show-window-count', () => {
                this._appManager.refresh();
            })
        );

        // Escuchar cambios en separador
        this._settingsChangedIds.push(
            settings.connect('changed::show-separator', () => {
                log('Configuración de separador cambiada, reconstruyendo...');
                this._appManager.forceRebuild();
            })
        );

        // Escuchar cambios en push-windows (reservar espacio)
        this._settingsChangedIds.push(
            settings.connect('changed::push-windows', () => {
                const enabled = this._settings.getPushWindows();
                log(`Push windows ${enabled ? 'enabled' : 'disabled'}`);
                // Actualizar la configuración de chrome
                if (this._dockContainer) {
                    const container = this._dockContainer.getContainer();
                    if (container) {
                        Main.layoutManager.removeChrome(container);
                        Main.layoutManager.addChrome(container, {
                            affectsStruts: enabled,
                            trackFullscreen: true,
                        });
                        this._dockContainer.updatePosition();
                    }
                }
            })
        );

        // Escuchar cambios en enable-bounce (animación de rebote)
        this._settingsChangedIds.push(
            settings.connect('changed::enable-bounce', () => {
                const enabled = this._settings.getEnableBounce();
                log(`Bounce animation ${enabled ? 'enabled' : 'disabled'}`);
                if (this._appManager._notificationBouncer) {
                    if (enabled) {
                        this._appManager._notificationBouncer.enable();
                    } else {
                        this._appManager._notificationBouncer.disable();
                    }
                }
            })
        );
    }

    _hideDash() {
        // Ocultar el dash de GNOME cuando está en overview
        const dash = Main.overview.dash;
        if (dash) {
            this._originalDashVisible = dash.visible;
            dash.hide();
        }
    }

    _restoreDash() {
        // Restaurar el dash de GNOME
        const dash = Main.overview.dash;
        if (dash && this._originalDashVisible !== undefined) {
            if (this._originalDashVisible) {
                dash.show();
            }
        }
    }

    disable() {
        try {
            log('Deshabilitando TuxDock...');

            // Desconectar señales de settings
            const settings = this._settings?.getSettings();
            if (settings) {
                this._settingsChangedIds.forEach(id => {
                    try {
                        settings.disconnect(id);
                    } catch (e) {
                        // Ignorar
                    }
                });
                this._settingsChangedIds = [];
            }

            // Desactivar minimizar
            if (this._minimizeManager) {
                this._minimizeManager.disable();
                this._minimizeManager = null;
            }

            // Desactivar autohide
            if (this._autohideManager) {
                this._autohideManager.disable();
                this._autohideManager = null;
            }

            // Desconectar señal de monitor
            if (this._monitorChangedId) {
                Main.layoutManager.disconnect(this._monitorChangedId);
                this._monitorChangedId = null;
            }

            // Deshabilitar gestor de aplicaciones
            if (this._appManager) {
                this._appManager.disable();
                this._appManager = null;
            }

            // Destruir contenedor
            if (this._dockContainer) {
                this._dockContainer.destroy();
                this._dockContainer = null;
            }

            // Restaurar el dash de GNOME
            this._restoreDash();

            this._settings = null;

            log('TuxDock deshabilitado correctamente');
        } catch (e) {
            logError('Error al deshabilitar TuxDock', e);
        }
    }
}

/**
 * Clase de extensión exportada para GNOME Shell
 */
export default class TuxDockExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._metadata = metadata;
        this._dock = null;
    }

    enable() {
        this._dock = new TuxDock(this);
        this._dock.enable();
    }

    disable() {
        if (this._dock) {
            this._dock.disable();
            this._dock = null;
        }
    }
}
