import Clutter from "gi://Clutter";
import Shell from "gi://Shell";
import GLib from "gi://GLib";

/**
 * Maneja animaciones del dock (rebotes, entradas, salidas)
 */
export class DockAnimations {
  constructor() {
    this._bounceAnimations = new Map();
    this._continuousBounces = new Map();
    this._windowTracker = Shell.WindowTracker.get_default();
  }

  /* ------------- bounce simple estilo macOS ------------- */

  bounceIcon(actor, bounces = 3, intensity = 0.35) {
    if (!actor) return;

    this.stopAllAnimations(actor);

    let current = 0;
    const baseHeight = 28;
    const duration = 130;

    const original = {
      sx: actor.scale_x,
      sy: actor.scale_y,
      tx: actor.translation_x,
      ty: actor.translation_y,
    };

    const scheduleNext = () => {
      current++;
      intensity *= 0.65;
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
        doBounce();
        return GLib.SOURCE_REMOVE;
      });
    };

    const onBounceDown = () => {
      actor.ease({
        translation_y: 0,
        duration,
        mode: Clutter.AnimationMode.EASE_IN_QUAD,
        onComplete: scheduleNext,
      });
    };

    const doBounce = () => {
      if (current >= bounces) {
        this._restoreActor(actor, original);
        this._bounceAnimations.delete(actor);
        return GLib.SOURCE_REMOVE;
      }

      const height = baseHeight * intensity;
      actor.ease({
        translation_y: -height,
        duration,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: onBounceDown,
      });
    };

    this._bounceAnimations.set(actor, true);
    doBounce();
  }

  /* ------------- rebote continuo hasta abrir ventana ------------- */

  bounceContinuous(actor, app, intensity = 0.4) {
    if (!actor || !app) return;
    if (this._continuousBounces.has(actor)) return;

    if (app.get_n_windows() > 0) return;

    const original = {
      sx: actor.scale_x,
      sy: actor.scale_y,
      tx: actor.translation_x,
      ty: actor.translation_y,
    };

    const duration = 160;
    const baseHeight = 30;
    let active = true;

    const scheduleNext = () => {
      if (active) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 90, () => {
          doBounce();
          return GLib.SOURCE_REMOVE;
        });
      }
    };

    const onBounceDown = () => {
      actor.ease({
        translation_y: 0,
        duration,
        mode: Clutter.AnimationMode.EASE_IN_QUAD,
        onComplete: scheduleNext,
      });
    };

    const doBounce = () => {
      if (!active) {
        this._restoreActor(actor, original);
        return GLib.SOURCE_REMOVE;
      }

      actor.ease({
        translation_y: -baseHeight * intensity,
        duration,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: onBounceDown,
      });
    };

    // comprobador de ventanas abiertas
    const checkId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
      if (app.get_n_windows() > 0) {
        active = false;
        this._restoreActor(actor, original);
        this._continuousBounces.delete(actor);
        return GLib.SOURCE_REMOVE;
      }
      return GLib.SOURCE_CONTINUE;
    });

    this._continuousBounces.set(actor, { active: true, checkId, original });
    doBounce();
  }

  stopContinuousBounce(actor) {
    const data = this._continuousBounces.get(actor);
    if (!data) return;

    if (data.checkId) GLib.source_remove(data.checkId);

    this._restoreActor(actor, data.original);
    this._continuousBounces.delete(actor);
  }

  /* ------------- utilidades internas ------------- */

  _restoreActor(actor, original) {
    if (!actor) return;
    actor.remove_all_transitions();

    actor.translation_x = original.tx ?? 0;
    actor.translation_y = original.ty ?? 0;
    actor.scale_x = original.sx ?? 1;
    actor.scale_y = original.sy ?? 1;
    actor.opacity = 255;
  }

  /* ------------- icon enter / exit / pulse ------------- */

  iconEnter(actor) {
    if (!actor) return;

    actor.opacity = 0;
    actor.scale_x = 0.3;
    actor.scale_y = 0.3;
    actor.set_pivot_point(0.5, 0.5);

    actor.ease({
      opacity: 255,
      scale_x: 1,
      scale_y: 1,
      duration: 220,
      mode: Clutter.AnimationMode.EASE_OUT_BACK,
    });
  }

  iconExit(actor, onComplete) {
    if (!actor) {
      onComplete?.();
      return;
    }

    actor.ease({
      opacity: 0,
      scale_x: 0.3,
      scale_y: 0.3,
      duration: 180,
      mode: Clutter.AnimationMode.EASE_IN_BACK,
      onComplete: () => onComplete?.(),
    });
  }

  pulseIcon(actor, duration = 300) {
    if (!actor) return;

    actor.ease({
      scale_x: 1.15,
      scale_y: 1.15,
      duration: duration / 2,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        actor.ease({
          scale_x: 1,
          scale_y: 1,
          duration: duration / 2,
          mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
      },
    });
  }

  dockEnter(container) {
    if (!container) return;

    container.translation_y = 80;
    container.opacity = 0;

    container.ease({
      translation_y: 0,
      opacity: 255,
      duration: 260,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }

  /* ------------- limpieza ------------- */

  stopAllAnimations(actor) {
    if (!actor) return;

    actor.remove_all_transitions();
    actor.opacity = 255;
    actor.scale_x = 1;
    actor.scale_y = 1;
    actor.translation_x = 0;
    actor.translation_y = 0;

    this._bounceAnimations.delete(actor);
    this.stopContinuousBounce(actor);
  }

  cleanup() {
    this._bounceAnimations.clear();

    this._continuousBounces.forEach((data) => {
      if (data.checkId) GLib.source_remove(data.checkId);
    });

    this._continuousBounces.clear();
  }
}

/* ------------- NotificationBouncer corregido ------------- */

export class NotificationBouncer {
  constructor(appManager, animations) {
    this._appManager = appManager;
    this._animations = animations;
    this._signalIds = [];
    this._windowTracker = Shell.WindowTracker.get_default();
  }

  enable() {
    this._signalIds.push(
      global.display.connect("window-demands-attention", (_, win) =>
        this._onAttention(win)
      )
    );
  }

  _onAttention(window) {
    if (!window) return;

    const app = this._windowTracker.get_window_app(window);
    if (!app) return;

    const icon = this._appManager._appIcons.get(app.get_id());
    if (!icon?.getActor) return;

    const actor = icon.getActor();
    if (!actor) return;

    this._animations.bounceIcon(actor, 4, 0.45);
  }

  disable() {
    this._signalIds.forEach((id) => {
      try {
        global.display.disconnect(id);
      } catch (error) {
        console.warn("Failed to disconnect signal:", error);
      }
    });

    this._signalIds = [];
  }
}
