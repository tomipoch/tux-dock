import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

/**
 * Vista previa de ventanas al pasar el cursor sobre un icono
 */
export class WindowPreview {
  _previewContainer = null;

  constructor() {
    this._currentApp = null;
    this._showTimeoutId = null;
    this._hideTimeoutId = null;
    this._layoutTimeoutId = null; // Track layout timeout for cleanup
  }

  show(app, sourceActor) {
    // Cancelar ocultamiento
    if (this._hideTimeoutId) {
      GLib.source_remove(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }

    // Si ya hay una preview del mismo app, no hacer nada
    if (this._currentApp === app && this._previewContainer) {
      return;
    }

    // Programar mostrar con delay
    if (this._showTimeoutId) {
      GLib.source_remove(this._showTimeoutId);
    }

    this._showTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      this._createPreview(app, sourceActor);
      this._showTimeoutId = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  _createPreview(app, sourceActor) {
    // Limpiar preview anterior
    this.hide();

    const windows = app.get_windows();
    if (windows.length === 0) return;

    this._currentApp = app;

    // Crear contenedor
    this._previewContainer = new St.BoxLayout({
      style_class: "window-preview-container",
      vertical: true,
      reactive: true,
    });

    this._previewContainer.set_style(`
            background-color: rgba(30, 30, 30, 0.95);
            border-radius: 12px;
            padding: 12px;
            spacing: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        `);

    // Añadir previews de ventanas
    windows.slice(0, 4).forEach((window, index) => {
      const preview = this._createWindowPreview(window);
      this._previewContainer.add_child(preview);
    });

    // Posicionar encima del icono
    Main.layoutManager.addChrome(this._previewContainer);

    // Esperar a que el contenedor se renderice para obtener dimensiones correctas
    this._previewContainer.show();

    const monitor = Main.layoutManager.primaryMonitor;
    const [sourceX, sourceY] = sourceActor.get_transformed_position();
    const sourceWidth = sourceActor.width;

    // Forzar un layout para obtener el tamaño real
    this._previewContainer.queue_relayout();

    // Usar timeout para asegurar que las dimensiones estén disponibles
    this._layoutTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
      try {
        if (!this._previewContainer) {
          this._layoutTimeoutId = null;
          return GLib.SOURCE_REMOVE;
        }

        const previewWidth = this._previewContainer.width || 220;
        const previewHeight = this._previewContainer.height || 100;

        // Calcular posición centrada sobre el icono
        let x = sourceX + sourceWidth / 2 - previewWidth / 2;
        let y = sourceY - previewHeight - 15;

        // Asegurar que no se salga de la pantalla
        if (x < monitor.x + 10) x = monitor.x + 10;
        if (x + previewWidth > monitor.x + monitor.width - 10) {
          x = monitor.x + monitor.width - previewWidth - 10;
        }
        if (y < monitor.y + 10) y = monitor.y + 10;

        this._previewContainer.set_position(x, y);
      } catch (e) {
        // En caso de error, limpiar
        if (this._previewContainer) {
          Main.layoutManager.removeChrome(this._previewContainer);
          this._previewContainer.destroy();
          this._previewContainer = null;
          this._currentApp = null;
        }
      }

      this._layoutTimeoutId = null;
      return GLib.SOURCE_REMOVE;
    });

    // Animar entrada
    this._previewContainer.opacity = 0;
    this._previewContainer.scale_y = 0.8;
    this._previewContainer.set_pivot_point(0.5, 1);

    this._previewContainer.ease({
      opacity: 255,
      scale_y: 1,
      duration: 200,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }

  _createWindowPreview(window) {
    const box = new St.Button({
      style_class: "window-preview-item",
      reactive: true,
      can_focus: true,
    });

    box.set_style(`
            padding: 8px;
            border-radius: 8px;
            min-width: 200px;
        `);

    const content = new St.BoxLayout({
      vertical: false,
      style: "spacing: 8px;",
    });

    // Thumbnail (simplificado - mostrar solo ícono por ahora)
    const thumbnail = new St.Icon({
      gicon: window.get_icon(),
      icon_size: 32,
    });

    // Título con indicador de minimizado
    const titleText = window.get_title() || "Sin título";
    const isMinimized = window.minimized;
    const displayText = isMinimized ? `[Minimizada] ${titleText}` : titleText;

    const title = new St.Label({
      text: displayText,
      style: `color: ${isMinimized ? "rgba(255, 255, 255, 0.6)" : "white"
        }; font-size: 12px;`,
      y_align: Clutter.ActorAlign.CENTER,
    });

    content.add_child(thumbnail);
    content.add_child(title);
    box.set_child(content);

    // Evento de click - activar o desminimizar
    box.connect("clicked", () => {
      if (window.minimized) {
        window.unminimize();
      }
      window.activate(global.get_current_time());
      this.hide();
    });

    // Hover
    box.connect("notify::hover", (btn) => {
      if (btn.hover) {
        btn.set_style(
          btn.get_style() +
          `
                    background-color: rgba(255, 255, 255, 0.1);
                `
        );
      } else {
        btn.set_style(`
                    padding: 8px;
                    border-radius: 8px;
                    min-width: 200px;
                `);
      }
    });

    return box;
  }

  hide() {
    // Cancelar mostrar
    if (this._showTimeoutId) {
      GLib.source_remove(this._showTimeoutId);
      this._showTimeoutId = null;
    }

    if (!this._previewContainer) return;

    // Animar salida
    this._previewContainer.ease({
      opacity: 0,
      scale_y: 0.8,
      duration: 150,
      mode: Clutter.AnimationMode.EASE_IN_QUAD,
      onComplete: () => {
        if (this._previewContainer) {
          this._previewContainer.destroy();
          this._previewContainer = null;
          this._currentApp = null;
        }
      },
    });
  }

  scheduleHide() {
    if (this._hideTimeoutId) return;

    this._hideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      this.hide();
      this._hideTimeoutId = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  cancelHide() {
    if (this._hideTimeoutId) {
      GLib.source_remove(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }
  }

  destroy() {
    this.hide();

    if (this._showTimeoutId) {
      GLib.source_remove(this._showTimeoutId);
      this._showTimeoutId = null;
    }

    if (this._layoutTimeoutId) {
      GLib.source_remove(this._layoutTimeoutId);
      this._layoutTimeoutId = null;
    }
  }
}
