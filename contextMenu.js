import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Menú contextual para iconos de aplicaciones
 * Permite fijar/desfijar y cerrar aplicaciones
 */
export class AppContextMenu extends PopupMenu.PopupMenu {
    constructor(source, app) {
        // Usar lado correcto según posición
        super(source, 0.0, St.Side.TOP);

        this._app = app;
        this._favorites = AppFavorites.getAppFavorites();

        this._buildMenu();
        
        // Añadir al uiGroup
        Main.uiGroup.add_child(this.actor);
    }

    _buildMenu() {
        // Opción para nueva ventana
        const windows = this._app.get_windows();
        if (windows.length > 0 || this._app.can_open_new_window()) {
            const newWindowItem = new PopupMenu.PopupMenuItem('Nueva ventana');
            newWindowItem.connect('activate', () => {
                this._app.open_new_window(-1);
            });
            this.addMenuItem(newWindowItem);
        }

        // Separador
        if (windows.length > 0) {
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // Mostrar todas las ventanas
        windows.forEach((window, index) => {
            const title = window.get_title() || this._app.get_name();
            const windowItem = new PopupMenu.PopupMenuItem(title);
            windowItem.connect('activate', () => {
                window.activate(global.get_current_time());
            });
            this.addMenuItem(windowItem);
        });

        // Separador antes de cerrar
        if (windows.length > 0) {
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            // Opción para cerrar todas las ventanas
            const closeAllItem = new PopupMenu.PopupMenuItem('Cerrar todas');
            closeAllItem.connect('activate', () => {
                windows.forEach(window => window.delete(global.get_current_time()));
            });
            this.addMenuItem(closeAllItem);
        }

        // Separador
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Opción para fijar/desfijar
        const isFavorite = this._favorites.isFavorite(this._app.get_id());
        const favoriteItem = new PopupMenu.PopupMenuItem(
            isFavorite ? 'Desfijar' : 'Fijar en el dock'
        );
        favoriteItem.connect('activate', () => {
            if (isFavorite) {
                this._favorites.removeFavorite(this._app.get_id());
            } else {
                this._favorites.addFavorite(this._app.get_id());
            }
        });
        this.addMenuItem(favoriteItem);
    }
}
