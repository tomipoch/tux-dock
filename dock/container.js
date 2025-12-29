import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { MagnificationEffect } from "../effects/magnification.js";

/**
 * Contenedor principal del dock
 */
export class DockContainer {
  constructor(settings) {
    this._container = null;
    this._icons = [];
    this._settings = settings;
    this._magnification = null;
  }

  build() {
    const position = this._settings.getPosition();
    const isVertical = position === "LEFT" || position === "RIGHT";

    // Set alignment based on position
    let xAlign = Clutter.ActorAlign.CENTER;
    let yAlign = Clutter.ActorAlign.CENTER;

    if (position === "BOTTOM") {
      yAlign = Clutter.ActorAlign.END;
    } else if (position === "TOP") {
      yAlign = Clutter.ActorAlign.START;
    } else if (position === "LEFT") {
      xAlign = Clutter.ActorAlign.START;
    } else if (position === "RIGHT") {
      xAlign = Clutter.ActorAlign.END;
    }

    this._container = new St.BoxLayout({
      style_class: "tux-dock-container",
      vertical: isVertical,
      reactive: true,
      track_hover: true,
      x_align: xAlign,
      y_align: yAlign,
    });

    this._applyStyle();

    Main.layoutManager.addChrome(this._container, {
      affectsStruts: this._settings.getPushWindows(),
      trackFullscreen: true,
    });

    this.updatePosition();

    this._magnification = new MagnificationEffect(
      this._container,
      this._settings
    );

    // Only enable if the setting is enabled
    if (this._settings.getMagnificationEnabled()) {
      this._magnification.enable();
    }

    return this._container;
  }

  /* ---------------- estilos y márgenes simétricos ---------------- */

  _applyStyle() {
    if (!this._container) return;

    const opacity = this._settings.getDockOpacity();
    const borderRadius = 18;
    const innerPadding = 6; // Reduced from 10 since icons have their own margins

    // padding IGUAL en todos los lados
    this._container.set_style(`
            background-color: rgba(40, 40, 40, ${opacity});
            border-radius: ${borderRadius}px;
            padding: ${innerPadding}px;
        `);

    // separación uniforme entre iconos
    this._container.set_style_class_name("tux-dock-container");

    // Reduced spacing since icons have margins
    this._container.spacing = 0;
  }

  /* ---------------- posicionamiento ---------------- */

  updatePosition() {
    if (!this._container) return;

    const monitor = Main.layoutManager.primaryMonitor;
    const position = this._settings.getPosition();
    const outerMargin = this._settings.getDockMargin();

    // Get workarea (excludes top bar)
    const workarea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

    // Actualizar orientación según posición
    const shouldBeVertical = position === "LEFT" || position === "RIGHT";
    if (this._container.vertical !== shouldBeVertical) {
      this._container.vertical = shouldBeVertical;
    }

    // quitamos animaciones para evitar saltos
    this._container.remove_all_transitions();

    // forzar recalculo
    this._container.queue_relayout();

    // esperar al relayout correcto, no setTimeout
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      if (!this._container) return GLib.SOURCE_REMOVE;

      const width = this._container.width;
      const height = this._container.height;

      if (position === "BOTTOM") {
        this._container.set_position(
          monitor.x + Math.floor((monitor.width - width) / 2),
          monitor.y + monitor.height - height - outerMargin
        );
      } else if (position === "TOP") {
        // TOP position should be below the topbar
        this._container.set_position(
          monitor.x + Math.floor((monitor.width - width) / 2),
          workarea.y + outerMargin
        );
      } else if (position === "LEFT") {
        // Center vertically within workarea (below topbar)
        this._container.set_position(
          monitor.x + outerMargin,
          workarea.y + Math.floor((workarea.height - height) / 2)
        );
      } else if (position === "RIGHT") {
        // Center vertically within workarea (below topbar)
        this._container.set_position(
          monitor.x + monitor.width - width - outerMargin,
          workarea.y + Math.floor((workarea.height - height) / 2)
        );
      }

      return GLib.SOURCE_REMOVE;
    });
  }

  /* ---------------- iconos ---------------- */

  addIcon(iconActor) {
    if (!this._container) return;

    iconActor.opacity = 0;
    iconActor.scale_x = 0.5;
    iconActor.scale_y = 0.5;

    this._container.add_child(iconActor);
    this._icons.push(iconActor);

    iconActor.ease({
      opacity: 255,
      scale_x: 1,
      scale_y: 1,
      duration: 180,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        this.updatePosition();
        if (this._magnification) this._magnification.reset();
      },
    });

    if (this._magnification) this._magnification.registerIcon(iconActor);
  }

  clearIcons() {
    if (!this._container) return;

    if (this._magnification) {
      this._magnification.clearIcons();
      this._magnification.reset();
    }

    this._container.remove_all_children();
    this._icons = [];
  }

  getContainer() {
    return this._container;
  }

  // Rebuild container completely when position changes
  rebuild() {
    // Save reference to chrome params
    const pushWindows = this._settings.getPushWindows();

    // Disable magnification
    if (this._magnification) {
      this._magnification.disable();
    }

    // Remove from chrome and destroy
    if (this._container) {
      Main.layoutManager.removeChrome(this._container);
      this._container.destroy();
      this._container = null;
    }

    // Rebuild container
    this.build();

    return this._container;
  }

  updateStyle() {
    this._applyStyle();
    this.updatePosition();
  }

  updateMagnification() {
    if (!this._magnification) return;

    const enabled = this._settings.getMagnificationEnabled();
    const scale = this._settings.getMagnificationScale();

    if (enabled) {
      this._magnification.setMaxScale(scale);
      this._magnification.enable();

      // Re-register all icons because disable() clears them
      if (this._icons) {
        this._icons.forEach(icon => {
          this._magnification.registerIcon(icon);
        });
      }
    } else {
      this._magnification.disable();
    }
  }

  destroy() {
    if (this._magnification) {
      this._magnification.disable();
      this._magnification = null;
    }

    if (this._container) {
      this._container.destroy();
      this._container = null;
    }

    this._icons = [];
  }
}
