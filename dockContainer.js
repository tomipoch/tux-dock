import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { MagnificationEffect } from "./magnification.js";

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

    this._container = new St.BoxLayout({
      style_class: "tux-dock-container",
      vertical: isVertical,
      reactive: true,
      track_hover: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END,
    });

    this._applyStyle();

    Main.layoutManager.addChrome(this._container, {
      affectsStruts: false,
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
    this._container.spacing = 2;
  }

  /* ---------------- posicionamiento ---------------- */

  updatePosition() {
    if (!this._container) return;

    const monitor = Main.layoutManager.primaryMonitor;
    const position = this._settings.getPosition();
    const outerMargin = this._settings.getDockMargin();

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
      const width = this._container.width;
      const height = this._container.height;

      if (position === "BOTTOM") {
        this._container.set_position(
          monitor.x + Math.floor((monitor.width - width) / 2),
          monitor.y + monitor.height - height - outerMargin
        );
      } else if (position === "TOP") {
        this._container.set_position(
          monitor.x + Math.floor((monitor.width - width) / 2),
          monitor.y + outerMargin
        );
      } else if (position === "LEFT") {
        this._container.set_position(
          monitor.x + outerMargin,
          monitor.y + Math.floor((monitor.height - height) / 2)
        );
      } else if (position === "RIGHT") {
        this._container.set_position(
          monitor.x + monitor.width - width - outerMargin,
          monitor.y + Math.floor((monitor.height - height) / 2)
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
      onComplete: () => this.updatePosition(),
    });

    if (this._magnification) this._magnification.registerIcon(iconActor);
  }

  clearIcons() {
    if (!this._container) return;

    if (this._magnification) this._magnification.clearIcons();

    this._container.remove_all_children();
    this._icons = [];
  }

  getContainer() {
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
