import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Menú contextual del separador
 */
export class SeparatorContextMenu extends PopupMenu.PopupMenu {
    constructor(source, settings) {
        const dockPos = settings?.getPosition?.() || 'BOTTOM';
        const side = dockPos === 'TOP' ? St.Side.BOTTOM :
                     dockPos === 'LEFT' ? St.Side.RIGHT :
                     dockPos === 'RIGHT' ? St.Side.LEFT :
                     St.Side.TOP;

        super(source, 0.0, side);

        this._settings = settings;
        this.blockSourceEvents = true;
        this.actor.style_class = 'tux-dock-context-menu';
        this.actor.reactive = true;

        this._buildMenu();

        Main.uiGroup.add_child(this.actor);

        this.actor.connect('key-focus-out', () => this.close());
        this.actor.connect('button-press-event', () => this.close());
    }

    _buildMenu() {
        this.removeAll();

        // Header
        const headerItem = new PopupMenu.PopupMenuItem('Configuración del Dock');
        headerItem.setSensitive(false);
        this.addMenuItem(headerItem);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Toggle Autohide
        const autohideItem = new PopupMenu.PopupSwitchMenuItem(
            'Ocultación automática',
            this._settings.getAutohide()
        );
        autohideItem.connect('toggled', (item) => {
            this._settings.setAutohide(item.state);
            this.close();
        });
        this.addMenuItem(autohideItem);

        // Toggle Magnification
        const magItem = new PopupMenu.PopupSwitchMenuItem(
            'Ampliación',
            this._settings.getMagnificationEnabled()
        );
        magItem.connect('toggled', (item) => {
            this._settings.setMagnificationEnabled(item.state);
            this.close();
        });
        this.addMenuItem(magItem);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Position submenu
        const positionMenu = new PopupMenu.PopupSubMenuMenuItem('Posición');
        const positions = [
            { label: 'Abajo', value: 'BOTTOM' },
            { label: 'Izquierda', value: 'LEFT' },
            { label: 'Derecha', value: 'RIGHT' },
        ];

        const currentPos = this._settings.getPosition();
        positions.forEach(pos => {
            const item = new PopupMenu.PopupMenuItem(pos.label);
            if (pos.value === currentPos) {
                item.setOrnament(PopupMenu.Ornament.DOT);
            }
            item.connect('activate', () => {
                this._settings.setPosition(pos.value);
                this.close();
            });
            positionMenu.menu.addMenuItem(item);
        });
        this.addMenuItem(positionMenu);

        // Minimize animation submenu
        const minimizeMenu = new PopupMenu.PopupSubMenuMenuItem('Minimizar usando');
        const animations = [
            { label: 'Escala', value: 'scale' },
            { label: 'Genie', value: 'genie' },
            { label: 'Ninguna', value: 'none' },
        ];

        const currentAnim = this._settings.getMinimizeAnimation();
        animations.forEach(anim => {
            const item = new PopupMenu.PopupMenuItem(anim.label);
            if (anim.value === currentAnim) {
                item.setOrnament(PopupMenu.Ornament.DOT);
            }
            item.connect('activate', () => {
                this._settings.setMinimizeAnimation(anim.value);
                this.close();
            });
            minimizeMenu.menu.addMenuItem(item);
        });
        this.addMenuItem(minimizeMenu);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Open preferences
        const prefsItem = new PopupMenu.PopupMenuItem('Configuración...');
        prefsItem.connect('activate', () => {
            this.close();
            // Open extension preferences
            try {
                const extensionObject = Main.extensionManager.lookup('tux-dock@tomipoch.github.com');
                if (extensionObject) {
                    extensionObject.openPreferences();
                }
            } catch (e) {
                console.error('[TuxDock] Error abriendo preferencias:', e);
            }
        });
        this.addMenuItem(prefsItem);
    }
}

/**
 * Separador interactivo del dock
 */
export class InteractiveSeparator {
    constructor(settings, appManager) {
        this._settings = settings;
        this._appManager = appManager;
        this._widget = null;
        this._menu = null;
        this._isDragging = false;
        this._dragStartY = 0;
        this._dragStartSize = 0;
        this._signalIds = [];
    }

    build() {
        const position = this._settings.getPosition();
        const isHorizontal = position === 'BOTTOM' || position === 'TOP';

        this._widget = new St.Button({
            style_class: 'tux-dock-separator',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: !isHorizontal,
            y_expand: isHorizontal,
        });

        this._updateStyle(false);

        // Hover effect
        this._signalIds.push(
            this._widget.connect('notify::hover', (btn) => {
                this._updateStyle(btn.hover);
            })
        );

        // Right click - context menu
        this._signalIds.push(
            this._widget.connect('button-press-event', (actor, event) => {
                if (event.get_button() === 3) {
                    this._openContextMenu();
                    return Clutter.EVENT_STOP;
                } else if (event.get_button() === 1) {
                    // Left click - start drag to resize
                    this._startDrag(event);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            })
        );

        this._signalIds.push(
            this._widget.connect('button-release-event', () => {
                this._endDrag();
                return Clutter.EVENT_STOP;
            })
        );

        this._signalIds.push(
            this._widget.connect('motion-event', (actor, event) => {
                if (this._isDragging) {
                    this._onDragMotion(event);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            })
        );

        return this._widget;
    }

    _updateStyle(isHovered) {
        const position = this._settings.getPosition();
        const isHorizontal = position === 'BOTTOM' || position === 'TOP';

        const bgColor = isHovered ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)';

        if (isHorizontal) {
            this._widget.set_style(`
                background-color: ${bgColor};
                margin: 4px 8px;
                min-width: 1px;
                max-width: 1px;
                min-height: 32px;
                transition-duration: 200ms;
                cursor: pointer;
            `);
        } else {
            this._widget.set_style(`
                background-color: ${bgColor};
                margin: 8px 4px;
                min-height: 1px;
                max-height: 1px;
                min-width: 32px;
                transition-duration: 200ms;
                cursor: pointer;
            `);
        }
    }

    _startDrag(event) {
        this._isDragging = true;
        const [x, y] = event.get_coords();
        this._dragStartY = y;
        this._dragStartSize = this._settings.getIconSize();

        global.display.set_cursor(Meta.Cursor.MOVE_OR_RESIZE_WINDOW);
    }

    _onDragMotion(event) {
        if (!this._isDragging) return;

        const [x, y] = event.get_coords();
        const deltaY = this._dragStartY - y; // Invertido: arriba = positivo

        // Calcular nuevo tamaño: +1 pixel cada 2 pixels de movimiento
        const sizeChange = Math.floor(deltaY / 2);
        const newSize = Math.max(32, Math.min(96, this._dragStartSize + sizeChange));

        // Aplicar nuevo tamaño
        if (newSize !== this._settings.getIconSize()) {
            this._settings.setIconSize(newSize);
        }
    }

    _endDrag() {
        if (this._isDragging) {
            this._isDragging = false;
            global.display.set_cursor(Meta.Cursor.DEFAULT);
        }
    }

    _openContextMenu() {
        if (this._menu) {
            this._menu.close();
            this._menu.destroy();
        }

        this._menu = new SeparatorContextMenu(this._widget, this._settings);
        this._menu.open();
    }

    getActor() {
        return this._widget;
    }

    destroy() {
        this._signalIds.forEach(id => {
            if (this._widget) {
                this._widget.disconnect(id);
            }
        });
        this._signalIds = [];

        if (this._menu) {
            this._menu.close();
            this._menu.destroy();
            this._menu = null;
        }

        if (this._widget) {
            this._widget.destroy();
            this._widget = null;
        }
    }
}
