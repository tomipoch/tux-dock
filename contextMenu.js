import St from "gi://St";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { getAppFavorites } from "resource:///org/gnome/shell/ui/appFavorites.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Util from "resource:///org/gnome/shell/misc/util.js";

export class AppContextMenu extends PopupMenu.PopupMenu {
  constructor(source, app, settings) {
    // lado del menú según dock
    const dockPos = settings?.getPosition?.() || "BOTTOM";
    const side =
      dockPos === "TOP"
        ? St.Side.BOTTOM
        : dockPos === "LEFT"
          ? St.Side.RIGHT
          : dockPos === "RIGHT"
            ? St.Side.LEFT
            : St.Side.TOP;

    super(source, 0.0, side);

    this._app = app;
    this._favorites = getAppFavorites();
    this._settings = settings;

    this.blockSourceEvents = true;

    this.actor.style_class = "tux-dock-context-menu";
    this.actor.reactive = true;

    this._buildMenu();

    Main.uiGroup.add_child(this.actor);

    // cerrar cuando se haga click fuera
    this.actor.connect("key-focus-out", () => this.close());
    this.actor.connect("button-press-event", () => this.close());
  }

  _addHeader() {
    const box = new St.BoxLayout({
      style_class: "tux-dock-menu-header",
      vertical: false,
      x_align: Clutter.ActorAlign.START,
      x_expand: true,
    });

    const icon = this._app.create_icon_texture(32);
    const title = new St.Label({
      text: this._app.get_name(),
      style: "font-weight: bold; margin-left: 8px;",
    });

    box.add_child(icon);
    box.add_child(title);

    const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    item.actor.add_child(box);

    this.addMenuItem(item);
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  }

  _addMenuItemWithIcon(label, iconName, callback) {
    const item = new PopupMenu.PopupMenuItem(label);

    const icon = new St.Icon({
      icon_name: iconName,
      style_class: "popup-menu-icon",
    });

    item.insert_child_at_index(icon, 0);
    item.connect("activate", callback);

    this.addMenuItem(item);

    return item;
  }

  _buildMenu() {
    const windows = this._app.get_windows();

    this.removeAll();

    /* -------- encabezado -------- */
    this._addHeader();

    /* -------- abrir nueva ventana -------- */
    if (this._app.can_open_new_window()) {
      this._addMenuItemWithIcon("Nueva ventana", "window-new-symbolic", () => {
        this._app.open_new_window(-1);
      });
    }

    /* -------- abrir en archivos -------- */
    const appInfo = this._app.get_app_info?.();
    if (appInfo) {
      this._addMenuItemWithIcon(
        "Mostrar en Archivos",
        "folder-open-symbolic",
        () => {
          const path = appInfo.get_filename();
          if (path) {
            Util.spawn(["xdg-open", GLib.path_get_dirname(path)]);
          }
        }
      );
    }

    /* -------- ventanas existentes -------- */
    if (windows.length > 0) {
      this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      windows.forEach((window) => {
        const title = window.get_title() || this._app.get_name();

        this._addMenuItemWithIcon(title, "window-symbolic", () => {
          window.activate(global.get_current_time());
          this.close();
        });
      });
    }

    /* -------- cerrar / forzar cierre -------- */
    if (windows.length > 0) {
      this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._addMenuItemWithIcon(
        "Cerrar todas",
        "application-exit-symbolic",
        () => {
          windows.forEach((w) => w.delete(global.get_current_time()));
        }
      );

      this._addMenuItemWithIcon(
        "Forzar cierre",
        "process-stop-symbolic",
        () => {
          windows.forEach((w) => w.kill());
        }
      );
    }

    /* -------- favoritos -------- */
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const isFav = this._favorites.isFavorite(this._app.get_id());

    this._addMenuItemWithIcon(
      isFav ? "Desfijar del dock" : "Fijar en el dock",
      isFav ? "starred-symbolic" : "non-starred-symbolic",
      () => {
        if (isFav) this._favorites.removeFavorite(this._app.get_id());
        else this._favorites.addFavorite(this._app.get_id());
      }
    );

    /* -------- información -------- */
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._addMenuItemWithIcon(
      "Información de la aplicación",
      "dialog-information-symbolic",
      () => {
        if (appInfo) Util.spawn(["gnome-info", this._app.get_id()]);
      }
    );
  }
}
