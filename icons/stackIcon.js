import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { log, logError } from '../core/utils.js';
import { Stack } from '../core/config.js';

/**
 * Popup que muestra el contenido de un stack en grid
 */
export class StackPopup extends PopupMenu.PopupMenu {
    constructor(sourceActor, stackPath) {
        super(sourceActor, 0.5, St.Side.TOP);

        this._stackPath = stackPath;
        this._gridBox = null;

        this._buildUI();
        this._loadItems();

        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
    }

    _buildUI() {
        // Contenedor scrollable
        const scrollView = new St.ScrollView({
            style_class: 'stack-popup-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            style: 'max-height: 400px; max-width: 320px;'
        });

        // Grid para los items
        this._gridBox = new St.BoxLayout({
            vertical: true,
            style_class: 'stack-popup-grid',
            style: 'padding: 12px; spacing: 8px;'
        });

        scrollView.add_actor(this._gridBox);
        this.box.add_child(scrollView);
    }

    _loadItems() {
        try {
            const dir = Gio.File.new_for_path(this._stackPath);
            const enumerator = dir.enumerate_children(
                'standard::*',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            let row = null;
            let itemsInRow = 0;

            while ((fileInfo = enumerator.next_file(null))) {
                // Crear nueva fila si es necesario
                if (!row || itemsInRow >= Stack.POPUP_COLUMNS) {
                    row = new St.BoxLayout({
                        style: 'spacing: 8px;'
                    });
                    this._gridBox.add_child(row);
                    itemsInRow = 0;
                }

                // Crear item
                const item = this._createFileItem(fileInfo, dir);
                row.add_child(item);
                itemsInRow++;
            }

            enumerator.close(null);

        } catch (e) {
            logError('Error cargando items del stack', e);
        }
    }

    _createFileItem(fileInfo, parentDir) {
        const fileName = fileInfo.get_name();
        const filePath = GLib.build_filenamev([parentDir.get_path(), fileName]);
        const file = Gio.File.new_for_path(filePath);

        // Contenedor del item
        const item = new St.Button({
            style_class: 'stack-popup-item',
            style: `width: ${Stack.POPUP_ITEM_SIZE}px; height: ${Stack.POPUP_ITEM_SIZE}px; padding: 4px;`,
            reactive: true,
            track_hover: true
        });

        const box = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 4px;'
        });

        // Icono
        const iconInfo = fileInfo.get_icon();
        const icon = new St.Icon({
            gicon: iconInfo,
            icon_size: Stack.ICON_SIZE,
            style: 'margin: 0;'
        });

        // Nombre truncado
        const label = new St.Label({
            text: fileName,
            style: 'font-size: 9pt; max-width: 60px;'
        });
        label.clutter_text.set_line_wrap(true);
        label.clutter_text.set_ellipsize(3); // END

        box.add_child(icon);
        box.add_child(label);
        item.set_child(box);

        // Click para abrir
        item.connect('clicked', () => {
            this._openFile(file);
            this.close();
        });

        return item;
    }

    _openFile(file) {
        try {
            const context = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(
                file.get_uri(),
                context
            );
        } catch (e) {
            logError('Error abriendo archivo del stack', e);
        }
    }

    destroy() {
        if (this.actor) {
            this.actor.destroy();
        }
    }
}

/**
 * Icono de Stack (carpeta) en el dock
 */
export class StackIcon {
    constructor(stackPath, stackName) {
        this.actor = null;
        this._stackPath = stackPath;
        this._stackName = stackName || GLib.path_get_basename(stackPath);
        this._popup = null;
        this._iconContainer = null;
        this._monitorId = null;

        this._build();
        this._startMonitoring();
    }

    _build() {
        // Contenedor principal
        this.actor = new St.Button({
            style_class: 'app-icon stack-icon',
            reactive: true,
            can_focus: true,
            track_hover: true,
            style: 'margin: 0 4px;'
        });

        const box = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 4px;'
        });

        // Contenedor de iconos apilados
        this._iconContainer = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            style: `width: 48px; height: 48px;`
        });

        this._updateStackedIcons();

        // Label
        const label = new St.Label({
            text: this._stackName,
            style: 'font-size: 9pt;'
        });

        box.add_child(this._iconContainer);
        box.add_child(label);
        this.actor.set_child(box);

        // Conectar click
        this.actor.connect('clicked', () => this._onClicked());

        // Drag and drop para añadir archivos
        this._setupDragDrop();
    }

    _updateStackedIcons() {
        // Limpiar iconos anteriores
        this._iconContainer.destroy_all_children();

        try {
            const dir = Gio.File.new_for_path(this._stackPath);
            const enumerator = dir.enumerate_children(
                'standard::*',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            let count = 0;
            const icons = [];

            // Recopilar primeros N archivos
            while ((fileInfo = enumerator.next_file(null)) && count < Stack.MAX_PREVIEW_ITEMS) {
                icons.push(fileInfo.get_icon());
                count++;
            }

            enumerator.close(null);

            // Crear iconos apilados con offset
            icons.forEach((gicon, index) => {
                const offset = index * 4;
                const icon = new St.Icon({
                    gicon: gicon,
                    icon_size: 40 - (index * 4),
                    style: `margin-left: ${offset}px; margin-top: ${offset}px;`
                });
                this._iconContainer.add_child(icon);
            });

            // Si no hay archivos, mostrar icono de carpeta vacía
            if (icons.length === 0) {
                const emptyIcon = new St.Icon({
                    icon_name: 'folder-symbolic',
                    icon_size: 40,
                    style_class: 'stack-empty-icon'
                });
                this._iconContainer.add_child(emptyIcon);
            }

        } catch (e) {
            logError('Error actualizando iconos del stack', e);

            // Fallback: icono de carpeta genérico
            const folderIcon = new St.Icon({
                icon_name: 'folder',
                icon_size: 48
            });
            this._iconContainer.add_child(folderIcon);
        }
    }

    _onClicked() {
        if (this._popup) {
            this._popup.destroy();
            this._popup = null;
            return;
        }

        // Crear y mostrar popup
        this._popup = new StackPopup(this.actor, this._stackPath);

        this._popup.connect('open-state-changed', (menu, open) => {
            if (!open) {
                this._popup.destroy();
                this._popup = null;
            }
        });

        this._popup.open();
    }

    _setupDragDrop() {
        // Permitir drop de archivos
        this.actor._delegate = this;
        this.actor.connect('drag-motion', () => Clutter.EVENT_PROPAGATE);
        this.actor.connect('drag-drop', () => Clutter.EVENT_PROPAGATE);
    }

    handleDragOver(source, actor, x, y, time) {
        // Aceptar archivos
        if (source._dragData && source._dragData.type === 'file') {
            return true;
        }
        return false;
    }

    acceptDrop(source, actor, x, y, time) {
        if (!source._dragData || source._dragData.type !== 'file') {
            return false;
        }

        try {
            const sourceFile = Gio.File.new_for_path(source._dragData.path);
            const destDir = Gio.File.new_for_path(this._stackPath);
            const destFile = destDir.get_child(sourceFile.get_basename());

            // Mover archivo al stack
            sourceFile.move(destFile, Gio.FileCopyFlags.NONE, null, null);

            log(`Archivo movido al stack: ${destFile.get_path()}`);
            return true;

        } catch (e) {
            logError('Error moviendo archivo al stack', e);
            return false;
        }
    }

    _startMonitoring() {
        try {
            const dir = Gio.File.new_for_path(this._stackPath);
            const monitor = dir.monitor_directory(
                Gio.FileMonitorFlags.NONE,
                null
            );

            this._monitorId = monitor.connect('changed', () => {
                this._updateStackedIcons();
            });

        } catch (e) {
            logError('Error monitoreando stack', e);
        }
    }

    destroy() {
        if (this._monitorId) {
            // Disconnect monitor
            this._monitorId = null;
        }

        if (this._popup) {
            this._popup.destroy();
            this._popup = null;
        }

        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
    }
}
