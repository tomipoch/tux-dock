import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { AppContextMenu } from "./contextMenu.js";
import { WindowPreview } from "./windowPreview.js";
import { DockSettings } from "./settings.js";
import { DockAnimations } from "./animations.js";

/**
 * Icono de aplicación del dock
 */
export class AppIcon {
  constructor(app, windowTracker, iconSize = 48) {
    this.app = app;
    this._windowTracker = windowTracker;
    this._iconSize = iconSize;

    this._container = null;
    this._button = null;
    this._icon = null;

    this._menu = null;
    this._tooltip = null;
    this._preview = new WindowPreview();

    this._tooltipTimeout = null;
    this._previewTimeout = null;

    this._badge = null;
    this._badgeCount = 0;

    this._settings = new DockSettings();
    this._animations = new DockAnimations();

    this._wasRunning = false;
  }

  /* ---------------- build ---------------- */

  build() {
    this._container = new St.BoxLayout({
      vertical: true,
      style_class: "tux-dock-icon-container",
      x_align: Clutter.ActorAlign.CENTER,
    });

    this._button = new St.Button({
      style_class: "tux-dock-app-button",
      reactive: true,
      can_focus: true,
      track_hover: true,
    });

    /* icono */
    this._icon = new St.Icon({
      gicon: this.app.get_app_info().get_icon(),
      icon_size: this._iconSize,
    });

    this._button.set_child(this._icon);

    /* badge */
    this._badge = new St.Label({
      visible: false,
      text: "",
      style_class: "tux-dock-badge",
    });

    this._badge.set_style(`
            background-color: #e74c3c;
            color: white;
            border-radius: 10px;
            padding: 2px 6px;
            font-weight: bold;
        `);

    const badgeBin = new St.Bin({
      y_align: Clutter.ActorAlign.START,
      x_align: Clutter.ActorAlign.END,
    });
    badgeBin.add_child(this._badge);

    const overlay = new St.Widget({
      layout_manager: new Clutter.BinLayout(),
    });

    overlay.add_child(this._icon);
    overlay.add_child(badgeBin);

    this._button.set_child(overlay);

    /* indicadores */
    this._indicators = new St.BoxLayout({
      vertical: false,
      x_align: Clutter.ActorAlign.CENTER,
    });

    this._container.add_child(this._button);
    this._container.add_child(this._indicators);

    this._createTooltip();
    this._connectEvents();
    this._updateVisualState();

    return this._container;
  }

  /* ---------------- estado visual ---------------- */

  _updateVisualState() {
    const windows = this.app.get_windows();
    const isRunning = windows.length > 0;

    if (isRunning && !this._wasRunning && this._settings.getEnableBounce())
      this._animations.bounceIcon(this._container, 2, 0.4);

    this._wasRunning = isRunning;

    this._indicators.remove_all_children();

    if (!isRunning) return;

    if (!this._settings.getShowRunningIndicator()) return;

    const count = this._settings.getShowWindowCount()
      ? Math.min(windows.length, 4)
      : 1;

    for (let i = 0; i < count; i++) {
      const dot = new St.Widget({
        width: 6,
        height: 6,
        style: "background-color: white; border-radius: 3px;",
      });
      this._indicators.add_child(dot);
    }
  }

  /* ---------------- eventos ---------------- */

  _connectEvents() {
    /* clics */
    this._button.connect("button-press-event", (_, event) => {
      const button = event.get_button();

      if (button === 1) this._onLeftClick();
      else if (button === 2) this._onMiddleClick();
      else if (button === 3) this._showContextMenu();

      return Clutter.EVENT_STOP;
    });

    /* hover → tooltip y preview */
    this._button.connect("notify::hover", (btn) => {
      if (btn.hover) {
        this._scheduleTooltip();
        this._schedulePreview();
      } else {
        this._hideTooltip();
        this._cancelPreview();
      }
    });

    /* scroll entre ventanas */
    this._button.connect("scroll-event", (_, event) => {
      if (this._settings.getScrollAction() === "cycle-windows")
        this._cycleWindows(event.get_scroll_direction());
      return Clutter.EVENT_STOP;
    });
  }

  /* ---------------- clicks ---------------- */

  _onLeftClick() {
    const windows = this.app.get_windows();

    if (windows.length === 0) {
      this.app.open_new_window(-1);
      return;
    }

    const focused = windows.find((w) => w.has_focus());

    if (focused) focused.minimize();
    else windows[0].activate(globalThis.get_current_time());
  }

  _onMiddleClick() {
    const action = this._settings.getMiddleClickAction();
    const windows = this.app.get_windows();

    if (action === "new-window") this.app.open_new_window(-1);
    else if (action === "minimize") windows.forEach((w) => w.minimize());
    else if (action === "quit") this.app.request_quit();
  }

  /* ---------------- ventanas con scroll ---------------- */

  _cycleWindows(direction) {
    const windows = this.app.get_windows();
    if (windows.length === 0) return;

    let index = windows.findIndex((w) => w.has_focus());

    if (
      direction === Clutter.ScrollDirection.UP ||
      direction === Clutter.ScrollDirection.LEFT
    )
      index = (index + 1) % windows.length;
    else index = (index - 1 + windows.length) % windows.length;

    windows[index].activate(globalThis.get_current_time());
  }

  /* ---------------- menu contextual ---------------- */

  _showContextMenu() {
    if (this._menu) this._menu.destroy();

    this._menu = new AppContextMenu(this._button, this.app, this._settings);
    this._menu.open(true);
  }

  /* ---------------- tooltip ---------------- */

  _createTooltip() {
    this._tooltip = new St.Label({
      text: this.app.get_name(),
      style_class: "tux-dock-tooltip",
    });

    this._tooltip.hide();
    Main.layoutManager.addChrome(this._tooltip);
  }

  _scheduleTooltip() {
    if (this._tooltipTimeout) return;

    this._tooltipTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      this._showTooltip();
      this._tooltipTimeout = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  _showTooltip() {
    if (!this._tooltip) return;

    const [x, y] = this._button.get_transformed_position();

    this._tooltip.set_position(
      Math.floor(x + this._button.width / 2 - this._tooltip.width / 2),
      Math.floor(y - this._tooltip.height - 8)
    );

    this._tooltip.opacity = 255;
    this._tooltip.show();
  }

  _hideTooltip() {
    if (this._tooltipTimeout) {
      GLib.source_remove(this._tooltipTimeout);
      this._tooltipTimeout = null;
    }

    if (this._tooltip) this._tooltip.hide();
  }

  /* ---------------- preview ---------------- */

  _schedulePreview() {
    if (this._previewTimeout) return;

    this._previewTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
      if (this._button.hover) this._preview.show(this.app, this._container);

      this._previewTimeout = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  _cancelPreview() {
    if (this._previewTimeout) {
      GLib.source_remove(this._previewTimeout);
      this._previewTimeout = null;
    }

    if (this._preview) this._preview.scheduleHide();
  }

  /* ---------------- badges ---------------- */

  setBadgeCount(count) {
    this._badgeCount = count;

    if (!this._badge) return;

    if (count > 0) {
      this._badge.text = count > 99 ? "99+" : `${count}`;
      this._badge.show();
    } else {
      this._badge.hide();
    }
  }

  /* ---------------- destroy ---------------- */

  destroy() {
    this._cancelPreview();
    this._hideTooltip();

    if (this._tooltip) {
      Main.layoutManager.removeChrome(this._tooltip);
      this._tooltip.destroy();
    }

    if (this._menu) this._menu.destroy();

    if (this._container) this._container.destroy();
  }
}
