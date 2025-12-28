import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

/**
 * Maneja el comportamiento de ocultamiento automático del dock
 */
export class AutohideManager {
  constructor(dockContainer, settings) {
    this._dockContainer = dockContainer;
    this._settings = settings;
    this._isHidden = false;
    this._mouseX = 0;
    this._mouseY = 0;
    this._checkTimeoutId = null;
    this._hideTimeoutId = null;
    this._showTimeoutId = null;
    this._motionEventId = null;

    // Configuración
    this._hideDelay = 300; // ms antes de ocultar
    this._showDelay = 100; // ms antes de mostrar
    this._edgeDistance = 5; // píxeles desde el borde para mostrar

    // Intellihide
    this._windowTracker = global.window_manager.get_window_tracker ? global.window_manager.get_window_tracker() : null;
    if (!this._windowTracker) {
      // Fallback for newer GS versions if needed
      const Shell = imports.gi.Shell;
      this._windowTracker = Shell.WindowTracker.get_default();
    }

    this._windowSignals = [];
  }

  enable() {
    if (!this._settings.getAutohide()) {
      return;
    }

    // Monitorear movimiento del mouse en toda la pantalla
    this._motionEventId = global.stage.connect(
      "motion-event",
      (actor, event) => {
        [this._mouseX, this._mouseY] = event.get_coords();
        this._checkMousePosition();
        return Clutter.EVENT_PROPAGATE;
      }
    );

    // Iniciar oculto
    this._hide(false);

    this._toggleIntellihideSignals(this._settings.getIntellihide());
  }

  _checkMousePosition() {
    const container = this._dockContainer.getContainer();
    if (!container) return;

    const monitor = Main.layoutManager.primaryMonitor;
    const [containerX, containerY] = container.get_transformed_position();
    const containerWidth = container.width;
    const containerHeight = container.height;

    // Verificar si el mouse está cerca del dock
    const isNearDock =
      this._mouseX >= containerX - 50 &&
      this._mouseX <= containerX + containerWidth + 50 &&
      this._mouseY >= containerY - 50 &&
      this._mouseY <= containerY + containerHeight + 50;

    // Check overlap for Intellihide
    const intellihide = this._settings.getIntellihide();
    const hasOverlap = intellihide ? this._checkOverlap(container) : false;

    // Verificar si está en el borde correspondiente según la posición del dock
    const position = this._settings.getPosition();
    let isAtEdge = false;

    switch (position) {
      case 'BOTTOM':
        isAtEdge = this._mouseY >= monitor.y + monitor.height - this._edgeDistance;
        break;
      case 'TOP':
        isAtEdge = this._mouseY <= monitor.y + this._edgeDistance;
        break;
      case 'LEFT':
        isAtEdge = this._mouseX <= monitor.x + this._edgeDistance;
        break;
      case 'RIGHT':
        isAtEdge = this._mouseX >= monitor.x + monitor.width - this._edgeDistance;
        break;
    }

    if (isNearDock || isAtEdge) {
      this._scheduleShow();
    } else {
      this._scheduleHide();
    }
    if (isNearDock || isAtEdge) {
      this._scheduleShow();
    } else {
      if (this._settings.getAutohide() || (intellihide && hasOverlap)) {
        this._scheduleHide();
      } else {
        this._scheduleShow();
      }
    }
  }

  _checkOverlap(container) {
    if (!container) return false;

    const monitor = Main.layoutManager.primaryMonitor;
    const workspace = JSON.stringify(global.workspace_manager.get_active_workspace_index()); // Trick to get current workspace index roughly
    // Better way:
    const activeWorkspace = global.workspace_manager.get_active_workspace();

    const windows = global.display.get_tab_list(0, activeWorkspace); // 0 = non-minimized, standard logic

    const [cx, cy] = container.get_transformed_position();
    const cw = container.width;
    const ch = container.height;

    // Simple intersection check
    for (let win of windows) {
      if (!win.appears_focused && !win.get_maximized() && win.get_window_type() !== 0) continue; // Check normal windows

      const rect = win.get_frame_rect();

      // Check intersection
      if (cx < rect.x + rect.width &&
        cx + cw > rect.x &&
        cy < rect.y + rect.height &&
        cy + ch > rect.y) {
        return true;
      }
    }
    return false;
  }

  _toggleIntellihideSignals(enabled) {
    if (enabled) {
      if (this._windowSignals.length > 0) return;

      // Helper to connect global signals safely
      const connectSignal = (obj, sig, callback) => {
        try {
          return obj.connect(sig, callback);
        } catch (e) { return 0; }
      };

      this._windowSignals.push({
        obj: global.window_manager,
        id: connectSignal(global.window_manager, 'map', () => this._checkMousePosition())
      });
      this._windowSignals.push({
        obj: global.window_manager,
        id: connectSignal(global.window_manager, 'minimize', () => this._checkMousePosition())
      });
      this._windowSignals.push({
        obj: global.window_manager,
        id: connectSignal(global.window_manager, 'unminimize', () => this._checkMousePosition())
      });
      this._windowSignals.push({
        obj: global.window_manager,
        id: connectSignal(global.window_manager, 'size-change', () => this._checkMousePosition())
      });
      this._windowSignals.push({
        obj: global.display,
        id: connectSignal(global.display, 'notify::focus-window', () => this._checkMousePosition())
      });
    } else {
      this._windowSignals.forEach(s => {
        if (s.id > 0) s.obj.disconnect(s.id);
      });
      this._windowSignals = [];
    }
  }

  _scheduleShow() {
    // Cancelar ocultamiento pendiente
    if (this._hideTimeoutId) {
      GLib.source_remove(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }

    // Si ya está visible, no hacer nada
    if (!this._isHidden) return;

    // Programar mostrar con delay
    if (!this._showTimeoutId) {
      this._showTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._showDelay, () => {
        this._show();
        this._showTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      });
    }
  }

  _scheduleHide() {
    // Cancelar mostrar pendiente
    if (this._showTimeoutId) {
      GLib.source_remove(this._showTimeoutId);
      this._showTimeoutId = null;
    }

    // Si ya está oculto, no hacer nada
    if (this._isHidden) return;

    // Programar ocultar con delay
    if (!this._hideTimeoutId) {
      this._hideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._hideDelay, () => {
        this._hide(true);
        this._hideTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      });
    }
  }

  _show() {
    const container = this._dockContainer.getContainer();
    if (!container || !this._isHidden) return;

    this._isHidden = false;

    // Animar entrada - resetear ambas translaciones
    container.ease({
      translation_x: 0,
      translation_y: 0,
      opacity: 255,
      duration: 250,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }

  _hide(animate = true) {
    const container = this._dockContainer.getContainer();
    if (!container) return;

    this._isHidden = true;

    const position = this._settings.getPosition();
    let hideX = 0;
    let hideY = 0;

    // Calcular distancia de ocultamiento según posición
    switch (position) {
      case 'BOTTOM':
        hideY = container.height + 30;
        break;
      case 'TOP':
        hideY = -(container.height + 30);
        break;
      case 'LEFT':
        hideX = -(container.width + 30);
        break;
      case 'RIGHT':
        hideX = container.width + 30;
        break;
    }

    if (animate) {
      // Animar salida completamente fuera de la pantalla
      container.ease({
        translation_x: hideX,
        translation_y: hideY,
        opacity: 0,
        duration: 200,
        mode: Clutter.AnimationMode.EASE_IN_QUAD,
      });
    } else {
      // Ocultar instantáneamente
      container.translation_x = hideX;
      container.translation_y = hideY;
      container.opacity = 0;
    }
  }

  setAutohide(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
      // Asegurar que esté visible
      const container = this._dockContainer.getContainer();
      if (container) {
        container.translation_y = 0;
        container.opacity = 255;
        this._isHidden = false;
      }
    }
  }

  setIntellihide(enabled) {
    this._toggleIntellihideSignals(enabled);
    this._checkMousePosition();
  }

  disable() {
    this._toggleIntellihideSignals(false);

    // Limpiar timeouts
    if (this._hideTimeoutId) {
      GLib.source_remove(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }

    if (this._showTimeoutId) {
      GLib.source_remove(this._showTimeoutId);
      this._showTimeoutId = null;
    }

    // Desconectar eventos
    if (this._motionEventId) {
      global.stage.disconnect(this._motionEventId);
      this._motionEventId = null;
    }

    // Mostrar el dock
    const container = this._dockContainer.getContainer();
    if (container) {
      container.remove_all_transitions();
      container.translation_y = 0;
      container.opacity = 255;
      this._isHidden = false;
    }
  }
}
