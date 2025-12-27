import Shell from "gi://Shell";
import St from "gi://St";
import GLib from "gi://GLib";

import * as AppFavorites from "resource:///org/gnome/shell/ui/appFavorites.js";

import { AppIcon } from "./appIcon.js";
import { DockSettings } from "./settings.js";
import { AppLauncherIcon, TrashIcon } from "./specialIcons.js";
import { DockAnimations, NotificationBouncer } from "./animations.js";
import { StackIcon } from "./stackIcon.js";
import { DragDropHandler } from "./dragAndDrop.js";

/**
 * Gestiona las aplicaciones mostradas en el dock
 * - apps fijadas
 * - apps abiertas
 * - iconos especiales
 */
export class AppManager {
  constructor(dockContainer) {
    this._dockContainer = dockContainer;

    this._appSystem = Shell.AppSystem.get_default();
    this._windowTracker = Shell.WindowTracker.get_default();

    this._appIcons = new Map(); // appId -> AppIcon
    this._stackIcons = new Map(); // path -> StackIcon

    this._settings = new DockSettings();
    this._signalIds = [];
    this._updateTimeout = null;

    this._appLauncher = null;
    this._trashIcon = null;
    this._separatorActors = [];

    this._animations = new DockAnimations();
    this._notificationBouncer = null;

    this._dragDropHandler = new DragDropHandler(this);
  }

  /* ---------------- enable / disable ---------------- */

  enable() {
    const container = this._dockContainer.getContainer();
    if (container) this._dragDropHandler.setupDropTarget(container, this);

    // cambios de instalación, ventanas, favoritos y nuevas ventanas
    this._signalIds.push(
      this._appSystem.connect("installed-changed", () =>
        this._scheduleRefresh()
      ),
      this._windowTracker.connect("tracked-windows-changed", () =>
        this._scheduleRefresh()
      ),
      AppFavorites.getAppFavorites().connect("changed", () => this.refresh()),
      globalThis.display.connect("window-created", () =>
        this._scheduleRefresh()
      )
    );

    // notificaciones con rebote
    this._notificationBouncer = new NotificationBouncer(this, this._animations);
    this._notificationBouncer.enable();

    this.refresh();
  }

  disable() {
    if (this._notificationBouncer) {
      this._notificationBouncer.disable();
      this._notificationBouncer = null;
    }

    if (this._animations) this._animations.cleanup();

    if (this._updateTimeout) {
      GLib.source_remove(this._updateTimeout);
      this._updateTimeout = null;
    }

    this._signalIds.forEach((id) => {
      try {
        this._appSystem.disconnect(id);
      } catch (error) {
        console.warn("Failed to disconnect appSystem signal:", error);
      }
      try {
        this._windowTracker.disconnect(id);
      } catch (error) {
        console.warn("Failed to disconnect windowTracker signal:", error);
      }
      try {
        AppFavorites.getAppFavorites().disconnect(id);
      } catch (error) {
        console.warn("Failed to disconnect favorites signal:", error);
      }
      try {
        globalThis.display.disconnect(id);
      } catch (error) {
        console.warn("Failed to disconnect display signal:", error);
      }
    });
    this._signalIds = [];

    this._destroyAllIcons();

    this._stackIcons.forEach((stack) => stack.destroy());
    this._stackIcons.clear();
  }

  /* ---------------- actualización ---------------- */

  _scheduleRefresh() {
    // debounce seguro
    if (this._updateTimeout) return;

    this._updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
      this._updateTimeout = null;
      this.refresh();
      return GLib.SOURCE_REMOVE;
    });
  }

  refresh() {
    const favorites = AppFavorites.getAppFavorites().getFavorites();
    const running = this._appSystem.get_running();

    const appsMap = new Map();
    const order = [];

    // favoritas primero
    favorites.forEach((app) => {
      const id = app.get_id();
      appsMap.set(id, app);
      order.push(id);
    });

    this._favoritesCount = favorites.length;

    // apps abiertas que no son favoritas
    running.forEach((app) => {
      const id = app.get_id();
      if (!appsMap.has(id)) {
        appsMap.set(id, app);
        order.push(id);
      }
    });

    const existingOrder = Array.from(this._appIcons.keys());
    const needsRebuild = !this._arraysEqual(existingOrder, order);

    if (needsRebuild) this._rebuildDock(appsMap, order);
    else this._appIcons.forEach((icon) => icon.updateState());
  }

  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;

    return true;
  }

  /* ---------------- reconstrucción ---------------- */

  _rebuildDock(appsMap, order) {
    this._dockContainer.clearIcons();
    this._destroyAllIcons();
    this._separatorActors = [];

    let added = 0;

    // lanzador al inicio
    if (this._settings.getShowAppLauncher()) this._addAppLauncher();

    order.forEach((appId) => {
      const app = appsMap.get(appId);
      if (!app) return;

      if (
        added === this._favoritesCount &&
        added > 0 &&
        order.length > this._favoritesCount
      ) {
        this._addSeparator();
      }

      this._addAppIcon(app);
      added++;
    });

    if (this._settings.getShowTrash() && added > 0) {
      this._addSeparator();
      this._addTrashIcon();
    }

    this._dockContainer.updatePosition();
  }

  forceRebuild() {
    this._updateTimeout = null;
    this.refresh();
  }

  /* ---------------- creación de iconos ---------------- */

  _addAppIcon(app) {
    const size = this._settings.getIconSize();
    const iconObj = new AppIcon(app, this._windowTracker, size);
    const actor = iconObj.build();

    this._dockContainer.addIcon(actor);
    this._appIcons.set(app.get_id(), iconObj);

    // drag & drop por ítem
    this._dragDropHandler.makeDraggable(iconObj);
    this._dragDropHandler.setupFileDropTarget(iconObj);
  }

  _addAppLauncher() {
    const size = this._settings.getIconSize();
    this._appLauncher = new AppLauncherIcon(size);

    const actor = this._appLauncher.build();
    this._dockContainer.addIcon(actor);
  }

  _addTrashIcon() {
    const size = this._settings.getIconSize();
    this._trashIcon = new TrashIcon(size);

    const actor = this._trashIcon.build();
    this._dockContainer.addIcon(actor);
  }

  _addSeparator() {
    const position = this._settings.getPosition();
    const horizontal = position === "BOTTOM" || position === "TOP";

    const separator = new St.Widget({
      style_class: "tux-dock-separator",
      reactive: false,
    });

    if (horizontal) {
      separator.set_style(`
                background-color: rgba(255,255,255,0.35);
                min-width: 1px;
                max-width: 1px;
                margin: 6px 10px;
            `);
    } else {
      separator.set_style(`
                background-color: rgba(255,255,255,0.35);
                min-height: 1px;
                max-height: 1px;
                margin: 10px 6px;
            `);
    }

    this._separatorActors.push(separator);
    this._dockContainer.addIcon(separator);
  }

  _destroyAllIcons() {
    this._appIcons.forEach((icon) => icon.destroy());
    this._appIcons.clear();

    if (this._appLauncher) {
      this._appLauncher.destroy();
      this._appLauncher = null;
    }

    if (this._trashIcon) {
      this._trashIcon.destroy();
      this._trashIcon = null;
    }

    this._separatorActors.forEach((s) => s.destroy());
    this._separatorActors = [];
  }

  /* ---------------- stacks (carpetas) ---------------- */

  addStack(path, name) {
    if (this._stackIcons.has(path)) return;

    const stack = new StackIcon(path, name);
    this._stackIcons.set(path, stack);

    const container = this._dockContainer.getContainer();
    if (container) container.add_child(stack.actor);
  }

  removeStack(path) {
    const stack = this._stackIcons.get(path);
    if (!stack) return;

    stack.destroy();
    this._stackIcons.delete(path);
  }

  getStacks() {
    return Array.from(this._stackIcons.keys());
  }
}
