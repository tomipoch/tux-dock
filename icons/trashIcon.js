import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import { logError } from '../core/utils.js';
import { IconSize, BorderRadius, Colors, CssClass, Trash } from '../core/config.js';
import { TrashContextMenu } from '../ui/contextMenu.js';

/**
 * Icono especial para la papelera
 */
export class TrashIcon {
    constructor(iconSize = IconSize.DEFAULT, settings) {
        this._button = null;
        this._iconSize = iconSize;
        this._settings = settings;
        this._icon = null;
        this._trashMonitor = null;
        this._trashPollId = null;
        this._signalIds = [];
        this._menu = null;
        this._menuManager = null;
        this._container = null;
        this._indicators = null;
    }

    build() {
        // Contenedor principal
        this._container = new St.BoxLayout({
            vertical: true,
            style_class: 'tux-dock-icon-container',
            x_align: Clutter.ActorAlign.CENTER,
        });

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
        if (!this._settings.getIconBackground()) {
            this._button.add_style_class_name('no-background');
        }

        // Crear icono de papelera
        this._icon = new St.Icon({
            icon_size: this._iconSize,
            style_class: 'trash-icon',
        });

        /* indicadores - dentro del botón según posición del dock */
        const position = this._settings.getPosition();
        const isVerticalDock = position === 'LEFT' || position === 'RIGHT';

        this._indicators = new St.BoxLayout({
            vertical: !isVerticalDock, // Horizontal para dock vertical, vertical para horizontal
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // Crear overlay para colocar icono e indicadores
        const overlay = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
        });

        overlay.add_child(this._icon);

        // Posicionar indicadores dentro del botón
        const indicatorsBin = new St.Bin({
            x_align: isVerticalDock ? 
                (position === 'LEFT' ? Clutter.ActorAlign.START : Clutter.ActorAlign.END) :
                Clutter.ActorAlign.CENTER,
            y_align: isVerticalDock ? 
                Clutter.ActorAlign.CENTER :
                Clutter.ActorAlign.END,
        });
        indicatorsBin.add_child(this._indicators);
        overlay.add_child(indicatorsBin);

        this._button.set_child(overlay);
        this._container.add_child(this._button);

        // Monitorear estado de la papelera
        this._updateTrashIcon();
        this._setupTrashMonitor();

        // Configurar como drop target para archivos
        this._setupDropTarget();

        // Conectar eventos
        this._signalIds.push(
            this._button.connect('clicked', () => {
                // Abrir papelera en el gestor de archivos
                try {
                    Gio.AppInfo.launch_default_for_uri('trash:///', null);
                } catch (e) {
                    logError('Error al abrir papelera', e);
                }
            })
        );

        // Context menu (Right click)
        this._signalIds.push(
            this._button.connect('button-press-event', (actor, event) => {
                if (event.get_button() === 3) {
                    this._openContextMenu();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            })
        );

        // Hover effect
        this._signalIds.push(
            this._button.connect('notify::hover', (btn) => {
                this._applyButtonStyle(btn.hover);
            })
        );

        return this._container;
    }

    _setupDropTarget() {
        // Configurar el botón como drop target para archivos
        this._button._delegate = {
            acceptDrop: (source, actor, x, y, time) => {
                // Aceptar archivos y moverlos a la papelera
                if (source._fileUri) {
                    return this._moveToTrash(source._fileUri);
                }
                return false;
            },

            handleDragOver: (source, actor, x, y, time) => {
                if (source._fileUri) {
                    // Resaltar la papelera cuando se arrastra un archivo sobre ella
                    this._button.add_style_pseudo_class(CssClass.DROP_TARGET);
                    this._button.set_style(this._button.get_style() + `
                        background-color: rgba(231, 76, 60, 0.3);
                        transform: scale(1.15);
                    `);
                    return DND.DragMotionResult.MOVE_DROP;
                }
                return DND.DragMotionResult.CONTINUE;
            }
        };

        // Remover el estilo cuando el drag sale
        this._button.connect('leave-event', () => {
            this._button.remove_style_pseudo_class(CssClass.DROP_TARGET);
            this._applyButtonStyle(false);
        });
    }

    _moveToTrash(fileUri) {
        try {
            const file = Gio.File.new_for_uri(fileUri);

            // Mover archivo a la papelera
            file.trash(null);

            console.log(`[TuxDock] Archivo movido a la papelera: ${fileUri}`);

            // Actualizar icono inmediatamente
            this._updateTrashIcon();

            // Animación de pulso para feedback visual
            this._button.ease({
                scale_x: 1.2,
                scale_y: 1.2,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this._button.ease({
                        scale_x: 1.0,
                        scale_y: 1.0,
                        duration: 100,
                        mode: Clutter.AnimationMode.EASE_IN_QUAD
                    });
                }
            });

            return true;
        } catch (e) {
            logError('Error moviendo archivo a la papelera', e);
            return false;
        }
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
            logError('Error al monitorear papelera', e);

            // Fallback: polling manual cada N segundos
            this._trashPollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, Trash.POLL_INTERVAL, () => {
                this._updateTrashIcon();
                return GLib.SOURCE_CONTINUE;
            });
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

            // Actualizar indicadores
            this._updateIndicators(hasItems);
        } catch (e) {
            // Si hay error, asumir vacía
            this._icon.icon_name = 'user-trash';
            this._updateIndicators(false);
        }
    }

    _updateIndicators(hasItems) {
        if (!this._indicators) return;

        this._indicators.remove_all_children();

        if (!hasItems) return;

        // Mostrar indicador cuando la papelera tiene contenido
        if (this._settings.getShowRunningIndicator()) {
            const dot = new St.Widget({
                width: 6,
                height: 6,
                style: 'background-color: white; border-radius: 3px; margin: 1px;',
            });
            this._indicators.add_child(dot);
        }
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
        return this._container;
    }

    _openContextMenu() {
        if (this._menu) {
            this._menu.close();
            this._menu.destroy();
        }

        this._menu = new TrashContextMenu(this._button, this._settings);
        this._menu.open();

        this._menu.actor.connect('destroy', () => {
            this._menu = null;
        });
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

        if (this._trashMonitor) {
            this._trashMonitor.cancel();
            this._trashMonitor = null;
        }

        if (this._trashPollId) {
            GLib.source_remove(this._trashPollId);
            this._trashPollId = null;
        }

        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }

        if (this._button) {
            this._button.destroy();
            this._button = null;
        }

        this._icon = null;
    }
}
