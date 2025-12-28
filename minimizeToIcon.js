import Clutter from "gi://Clutter";
import Shell from "gi://Shell";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { DockSettings } from "./settings.js";

/* ---------------- Dock directions ---------------- */

const DockDirection = {
  BOTTOM: 0,
  TOP: 1,
  LEFT: 2,
  RIGHT: 3,
};

/* ---------------- Magic Lamp Effect ---------------- */

const MagicLampEffect = GObject.registerClass(
  class MagicLampEffect extends Clutter.DeformEffect {
    _init(params = {}) {
      super._init(params);

      this._progress = 0;
      this._direction = DockDirection.BOTTOM;

      // Más tiles = curva más suave (coste mayor CPU/GPU)
      this.set_n_tiles(48, 24);
    }

    setProgress(p) {
      this._progress = Math.max(0, Math.min(1, p));
      this.invalidate();
    }

    setDirection(dir) {
      this._direction = dir;
      this.invalidate();
    }

    _easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    vfunc_deform_vertex(width, height, vertex) {
      const p = this._easeInOutCubic(this._progress);

      let x = vertex.x;
      let y = vertex.y;

      let w = width;
      let h = height;

      /* ------ reorientar a “dock abajo” ------ */

      if (this._direction === DockDirection.TOP) {
        y = h - y;
      } else if (this._direction === DockDirection.LEFT) {
        const tmp = x;
        x = y;
        y = h - tmp;
        w = height;
        h = width;
      } else if (this._direction === DockDirection.RIGHT) {
        const tmp = x;
        x = w - y;
        y = tmp;
        w = height;
        h = width;
      }

      /* ------ normalización ------ */

      const nx = x / w - 0.5;
      const ny = y / h;

      /* -------- curva Compiz-like -------- */

      const tail = Math.pow(ny, 3.2); // estiramiento fuerte abajo
      const squeeze = p * tail;

      const collapsedNy = ny * (1 - p * 0.85) + p;

      const maxBend = 0.35;
      const bend = maxBend * squeeze;
      const curvedNx = nx * (1 - bend) + nx * nx * nx * bend;

      let newX = (curvedNx + 0.5) * w;
      let newY = collapsedNy * h;

      /* ------ revertir rotaciones ------ */

      if (this._direction === DockDirection.TOP) {
        newY = h - newY;
      } else if (this._direction === DockDirection.LEFT) {
        const tmp = newY;
        newY = h - newX;
        newX = tmp;
      } else if (this._direction === DockDirection.RIGHT) {
        const tmp = newY;
        newY = newX;
        newX = w - tmp;
      }

      vertex.x = newX;
      vertex.y = newY;
    }
  }
);

/* ---------------- Minimize / Restore ---------------- */

export class MinimizeToIcon {
  constructor(dockContainer, appManager, settings) {
    this._dockContainer = dockContainer;
    this._appManager = appManager;
    this._windowTracker = Shell.WindowTracker.get_default();
    this._settings = settings; // Use passed settings instead of creating new instance
    this._signalIds = [];
    this._timeouts = [];
    this._activeClones = new Set();
  }

  enable() {
    if (!this._settings.getMinimizeToDock()) return;

    this._signalIds.push(
      global.window_manager.connect("minimize", (wm, actor) => {
        this._onMinimize(actor);
      }),
      global.window_manager.connect("unminimize", (wm, actor) => {
        this._onUnminimize(actor);
      })
    );
  }

  setEnabled(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  /* ---------------- minimize ---------------- */

  _onMinimize(actor) {
    const window = actor.meta_window;
    const app = this._windowTracker.get_window_app(window);
    if (!app) return;

    const iconData = this._appManager._appIcons.get(app.get_id());
    if (!iconData) return;

    const iconActor = iconData.getActor();
    if (!iconActor) return;

    const animationType = this._settings.getMinimizeAnimation();
    if (animationType === "none") return;

    /* guardar posición original */
    const rect = window.get_frame_rect();
    window._originalPosition = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };

    const [winX, winY] = actor.get_transformed_position();
    const [winW, winH] = actor.get_transformed_size();

    const [iconX, iconY] = iconActor.get_transformed_position();
    const [iconW, iconH] = iconActor.get_transformed_size();
    const iconCenterX = iconX + iconW / 2;
    const iconCenterY = iconY + iconH / 2;

    const clone = new Clutter.Clone({
      source: actor,
      x: winX,
      y: winY,
      width: winW,
      height: winH,
      opacity: 255,
    });

    Main.uiGroup.add_child(clone);

    actor.hide();

    /* simple scale fallback */

    if (animationType === "scale") {
      clone.set_pivot_point(0.5, 0.5);

      clone.ease({
        x: iconCenterX - winW / 2,
        y: iconCenterY - winH / 2,
        scale_x: 0,
        scale_y: 0,
        opacity: 0,
        duration: 250,
        mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
        onComplete: () => {
          clone.destroy();
          this._activeClones.delete(clone);
        },
      });
      this._activeClones.add(clone);

      return;
    }

    /* -------- Magic Lamp -------- */

    const dockPos = this._settings.getPosition?.() || "BOTTOM";

    let direction = DockDirection.BOTTOM;
    if (dockPos === "TOP") direction = DockDirection.TOP;
    else if (dockPos === "LEFT") direction = DockDirection.LEFT;
    else if (dockPos === "RIGHT") direction = DockDirection.RIGHT;

    const effect = new MagicLampEffect();
    effect.setDirection(direction);

    /* asegurar mappeo antes del efecto */
    clone.connect("map", () => clone.add_effect(effect));
    this._activeClones.add(clone);

    if (direction === DockDirection.BOTTOM) clone.set_pivot_point(0.5, 1);
    else if (direction === DockDirection.TOP) clone.set_pivot_point(0.5, 0);
    else if (direction === DockDirection.LEFT) clone.set_pivot_point(0, 0.5);
    else if (direction === DockDirection.RIGHT) clone.set_pivot_point(1, 0.5);

    const durationMs = 350;
    const start = GLib.get_monotonic_time();
    const end = start + durationMs * 1000;

    const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000 / 60, () => {
      const now = GLib.get_monotonic_time();
      let t = (now - start) / (end - start);
      if (t >= 1) t = 1;

      const k = t * t * (3 - 2 * t);

      const curX = winX + (iconCenterX - winX) * k;
      const curY = winY + (iconCenterY - winY) * k;

      clone.set_position(curX - winW * 0.5, curY - winH * 0.5);

      const s = 1 - 0.4 * k;
      clone.set_scale(s, s);

      effect.setProgress(k);

      clone.opacity = 255 * (1 - k * 0.9);

      if (t >= 1) {
        clone.destroy();
        this._activeClones.delete(clone);
        return GLib.SOURCE_REMOVE;
      }

      return GLib.SOURCE_CONTINUE;
    });

    this._timeouts.push(id);
  }

  /* ---------------- unminimize ---------------- */

  _onUnminimize(actor) {
    const window = actor.meta_window;
    const app = this._windowTracker.get_window_app(window);
    if (!app) return;

    const iconData = this._appManager._appIcons.get(app.get_id());
    if (!iconData) return;

    const iconActor = iconData.getActor();
    if (!iconActor) return;

    /* Force update position to ensure correct origin */
    if (this._dockContainer) this._dockContainer.updatePosition();

    const animationType = this._settings.getMinimizeAnimation();
    if (animationType === "none") return;

    const [iconX, iconY] = iconActor.get_transformed_position();
    const [iconW, iconH] = iconActor.get_transformed_size();
    const iconCenterX = iconX + iconW / 2;
    const iconCenterY = iconY + iconH / 2;

    const orig = window._originalPosition || window.get_frame_rect();
    // Calculate destination center
    const destCenterX = orig.x + orig.width / 2;
    const destCenterY = orig.y + orig.height / 2;

    window.move_frame(true, orig.x, orig.y);

    const clone = new Clutter.Clone({
      source: actor,
      x: iconCenterX - orig.width / 2, // Start centered on icon
      y: iconCenterY - orig.height / 2,
      width: orig.width,
      height: orig.height,
      scale_x: 0.6,
      scale_y: 0.6,
      opacity: 0,
    });

    Main.uiGroup.add_child(clone);

    actor.opacity = 0;

    if (animationType === "scale") {
      clone.set_pivot_point(0.5, 0.5);
      clone.ease({
        x: orig.x,
        y: orig.y,
        scale_x: 1,
        scale_y: 1,
        opacity: 255,
        duration: 250,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
          actor.opacity = 255;
          actor.show();
          clone.destroy();
          this._activeClones.delete(clone);
          delete window._originalPosition;
        },
      });
      this._activeClones.add(clone);

      return;
    }

    const dockPos = this._settings.getPosition?.() || "BOTTOM";

    let direction = DockDirection.BOTTOM;
    if (dockPos === "TOP") direction = DockDirection.TOP;
    else if (dockPos === "LEFT") direction = DockDirection.LEFT;
    else if (dockPos === "RIGHT") direction = DockDirection.RIGHT;

    const effect = new MagicLampEffect();
    effect.setDirection(direction);
    effect.setProgress(1);

    clone.connect("map", () => clone.add_effect(effect));
    this._activeClones.add(clone);

    // Set pivot point matching direction for correct expansion
    if (direction === DockDirection.BOTTOM) clone.set_pivot_point(0.5, 1);
    else if (direction === DockDirection.TOP) clone.set_pivot_point(0.5, 0);
    else if (direction === DockDirection.LEFT) clone.set_pivot_point(0, 0.5);
    else if (direction === DockDirection.RIGHT) clone.set_pivot_point(1, 0.5);

    const durationMs = 300;
    const start = GLib.get_monotonic_time();
    const end = start + durationMs * 1000;

    const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000 / 60, () => {
      const now = GLib.get_monotonic_time();
      let t = (now - start) / (end - start);
      if (t >= 1) t = 1;

      const k = t * t * (3 - 2 * t);
      const p = 1 - k;

      // Interpolate CENTERS
      const curCenterX = iconCenterX + (destCenterX - iconCenterX) * k;
      const curCenterY = iconCenterY + (destCenterY - iconCenterY) * k;

      // Set position based on center (Top-Left = Center - HalfSize)
      clone.set_position(curCenterX - orig.width / 2, curCenterY - orig.height / 2);

      const s = 0.6 + 0.4 * k;
      clone.set_scale(s, s);

      effect.setProgress(p);
      clone.opacity = 255 * k;

      if (t >= 1) {
        this._finishUnminimize(actor, clone, window);
        return GLib.SOURCE_REMOVE;
      }

      return GLib.SOURCE_CONTINUE;
    });

    this._timeouts.push(id);
  }

  _finishUnminimize(actor, clone, window) {
    actor.opacity = 255;
    actor.show();
    clone.destroy();
    this._activeClones.delete(clone);
    if (window._originalPosition) delete window._originalPosition;
  }

  disable() {
    this._signalIds.forEach((id) => {
      try {
        global.window_manager.disconnect(id);
      } catch (error) {
        console.warn("Failed to disconnect signal:", error);
      }
    });

    this._signalIds = [];

    this._timeouts.forEach((id) => GLib.source_remove(id));
    this._timeouts = [];

    // Destroy lingering clones
    this._activeClones.forEach(clone => {
      try {
        clone.destroy();
      } catch (e) { }
    });
    this._activeClones.clear();
  }
}
