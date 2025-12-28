import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as DND from "resource:///org/gnome/shell/ui/dnd.js";
import * as AppFavorites from "resource:///org/gnome/shell/ui/appFavorites.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import St from "gi://St";
import { log, logError } from "./utils.js";

/**
 * Maneja el arrastrar y soltar de iconos en el dock estilo macOS
 */
export class DragDropHandler {
  constructor(appManager) {
    this._appManager = appManager;
    this._dragMonitor = null;
    this._isOutsideDock = false;
    this._removalIndicator = null;
    this._insertionIndicator = null;
    this._dragThreshold = 50; // píxeles desde el borde del dock
  }

  makeDraggable(appIcon) {
    const actor = appIcon.getActor();
    if (!actor) return;

    // Si ya había delegate, lo mezclamos
    const originalDelegate = actor._delegate || {};

    actor._delegate = {
      ...originalDelegate,

      app: appIcon.app,

      getDragActor: () => {
        return appIcon.app.create_icon_texture(48);
      },

      getDragActorSource: () => {
        return actor;
      },

      acceptDrop: (source, targetActor, x, y, time) => {
        // Reordenar iconos dentro del dock
        if (source.app && source !== targetActor._delegate) {
          log("[TuxDock] Reordenando iconos");
          return this._handleReorder(source.app, appIcon.app);
        }

        if (originalDelegate.acceptDrop) {
          return originalDelegate.acceptDrop(source, targetActor, x, y, time);
        }

        return false;
      },

      handleDragOver: (source, targetActor, x, y, time) => {
        if (source.app) {
          this._showInsertionIndicator(targetActor, x, y);
          return DND.DragMotionResult.MOVE_DROP;
        }

        if (originalDelegate.handleDragOver) {
          return originalDelegate.handleDragOver(
            source,
            targetActor,
            x,
            y,
            time
          );
        }

        return DND.DragMotionResult.CONTINUE;
      },
    };

    const draggable = DND.makeDraggable(actor, {
      restoreOnSuccess: false,
      manualMode: false,
      dragActorMaxSize: 48,
    });

    draggable.connect("drag-begin", () => {
      actor.opacity = 100;
      this._setupDragMonitor(actor, appIcon);

      if (this._appManager._dockContainer._magnification) {
        this._appManager._dockContainer._magnification.setDragging(true);
      }

      log("[TuxDock] Drag comenzado");
    });

    draggable.connect("drag-end", () => {
      actor.opacity = 255;
      this._onDragEnd(appIcon);
      this._cleanupDragMonitor();

      if (this._appManager._dockContainer._magnification) {
        this._appManager._dockContainer._magnification.setDragging(false);
      }

      log("[TuxDock] Drag terminado");
    });

    actor._appIcon = appIcon;
    actor._draggable = draggable;
  }

  _setupDragMonitor(actor, appIcon) {
    this._isOutsideDock = false;

    this._dragMonitor = {
      dragMotion: (dragEvent) => {
        const [x, y] = global.get_pointer();
        const dockBounds = this._getDockBounds();

        const isOutside = !this._isInsideDock(x, y, dockBounds);

        if (isOutside !== this._isOutsideDock) {
          this._isOutsideDock = isOutside;
          this._showRemovalIndicator(isOutside);
        }

        return DND.DragMotionResult.CONTINUE;
      },
    };

    DND.addDragMonitor(this._dragMonitor);
  }

  _cleanupDragMonitor() {
    if (this._dragMonitor) {
      DND.removeDragMonitor(this._dragMonitor);
      this._dragMonitor = null;
    }

    this._hideRemovalIndicator();
    this._hideInsertionIndicator();
    this._isOutsideDock = false;
  }

  _getDockBounds() {
    const container = this._appManager._dockContainer.getContainer();
    if (!container) return null;

    const [x, y] = container.get_transformed_position();
    const width = container.width;
    const height = container.height;

    return {
      x: x - this._dragThreshold,
      y: y - this._dragThreshold,
      width: width + this._dragThreshold * 2,
      height: height + this._dragThreshold * 2,
    };
  }

  _isInsideDock(x, y, bounds) {
    if (!bounds) return true;

    return (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    );
  }

  _showRemovalIndicator(show) {
    if (show) {
      if (!this._removalIndicator) {
        this._removalIndicator = new St.Label({
          text: "✕ Soltar para quitar",
          style_class: "tux-dock-removal-indicator",
        });

        this._removalIndicator.set_style(`
                    background-color: rgba(231, 76, 60, 0.9);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 12pt;
                    font-weight: bold;
                `);

        Main.layoutManager.addChrome(this._removalIndicator);
      }

      const [mouseX, mouseY] = global.get_pointer();

      this._removalIndicator.set_position(
        mouseX - this._removalIndicator.width / 2,
        mouseY - 60
      );

      this._removalIndicator.opacity = 0;
      this._removalIndicator.show();

      this._removalIndicator.ease({
        opacity: 255,
        duration: 150,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      });
    } else {
      this._hideRemovalIndicator();
    }
  }

  _hideRemovalIndicator() {
    if (this._removalIndicator) {
      this._removalIndicator.ease({
        opacity: 0,
        duration: 150,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
          if (this._removalIndicator) {
            Main.layoutManager.removeChrome(this._removalIndicator);
            this._removalIndicator.destroy();
            this._removalIndicator = null;
          }
        },
      });
    }
  }

  _showInsertionIndicator(targetActor, x, y) {
    // Limpiar indicador previo
    this._hideInsertionIndicator();

    if (!targetActor) return;

    // Crear línea indicadora
    this._insertionIndicator = new St.Widget({
      style_class: 'tux-dock-insertion-indicator',
      width: 3,
      height: 48,
    });

    this._insertionIndicator.set_style(`
      background-color: rgba(52, 152, 219, 0.8);
      border-radius: 2px;
      box-shadow: 0 0 8px rgba(52, 152, 219, 0.6);
    `);

    // Obtener posición del contenedor del dock
    const dockContainer = this._appManager._dockContainer.getContainer();
    if (!dockContainer) return;

    const isVertical = dockContainer.vertical;

    // Determinar si insertar antes o después del target
    const [targetX, targetY] = targetActor.get_transformed_position();
    const targetWidth = targetActor.width;
    const targetHeight = targetActor.height;

    let indicatorX, indicatorY;

    if (isVertical) {
      // Dock vertical (LEFT o RIGHT)
      const midY = targetY + targetHeight / 2;
      const insertBefore = y < midY;

      this._insertionIndicator.width = 48;
      this._insertionIndicator.height = 3;

      indicatorX = targetX;
      indicatorY = insertBefore ? targetY - 2 : targetY + targetHeight - 1;
    } else {
      // Dock horizontal (BOTTOM o TOP)
      const midX = targetX + targetWidth / 2;
      const insertBefore = x < midX;

      this._insertionIndicator.width = 3;
      this._insertionIndicator.height = 48;

      indicatorX = insertBefore ? targetX - 2 : targetX + targetWidth - 1;
      indicatorY = targetY;
    }

    Main.layoutManager.addChrome(this._insertionIndicator);
    this._insertionIndicator.set_position(indicatorX, indicatorY);

    // Animar entrada
    this._insertionIndicator.opacity = 0;
    this._insertionIndicator.ease({
      opacity: 255,
      duration: 100,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }

  _hideInsertionIndicator() {
    if (this._insertionIndicator) {
      Main.layoutManager.removeChrome(this._insertionIndicator);
      this._insertionIndicator.destroy();
      this._insertionIndicator = null;
    }
  }

  _onDragEnd(appIcon) {
    // Soltado fuera del dock -> eliminar de favoritos
    if (this._isOutsideDock) {
      const favorites = AppFavorites.getAppFavorites();
      const appId = appIcon.app.get_id();

      if (favorites.isFavorite(appId)) {
        log(`[TuxDock] Removiendo app de favoritos: ${appId}`);
        favorites.removeFavorite(appId);
        this._showPoofAnimation(appIcon);
      }
    }

    // Forzar refresh para reorganizar (usa GLib, no setTimeout)
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this._appManager.refresh();
      return GLib.SOURCE_REMOVE;
    });
  }

  _showPoofAnimation(appIcon) {
    const actor = appIcon.getActor();
    if (!actor) return;

    actor.ease({
      opacity: 0,
      scale_x: 0.3,
      scale_y: 0.3,
      duration: 200,
      mode: Clutter.AnimationMode.EASE_IN_BACK,
      onComplete: () => {
        // El refresh del appManager se encargará de eliminarlo
      },
    });
  }

  /**
   * Reordenar favoritos usando la API real de AppFavorites
   */
  _handleReorder(sourceApp, targetApp) {
    try {
      const favorites = AppFavorites.getAppFavorites();

      const list = favorites.getFavorites();
      const ids = list.map((app) => app.get_id());

      const sourceId = sourceApp.get_id();
      const targetId = targetApp.get_id();

      const sourceIndex = ids.indexOf(sourceId);
      const targetIndex = ids.indexOf(targetId);

      if (sourceIndex === -1 || targetIndex === -1) return false;

      // Índice destino corregido si arrastramos hacia delante
      const newTargetIndex =
        sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

      log(`[TuxDock] moveFavorite ${sourceId} -> posición ${newTargetIndex}`);

      favorites.moveFavorite(sourceId, newTargetIndex);
      return true;
    } catch (e) {
      logError("Error reordenando iconos", e);
      return false;
    }
  }

  setupDropTarget(container, appManager) {
    if (!container) return;

    container.reactive = true;
    container.track_hover = true;

    container._delegate = {
      acceptDrop: (source, actor, x, y, time) => {
        log("[TuxDock] acceptDrop llamado");

        if (source.app) {
          log(`[TuxDock] Fijando app: ${source.app.get_name()}`);
          const favorites = AppFavorites.getAppFavorites();
          const appId = source.app.get_id();

          if (!favorites.isFavorite(appId)) {
            favorites.addFavorite(appId);
            log(`[TuxDock] App ${appId} añadida a favoritos`);

            // Animación de feedback
            this._showAddedFeedback(container);
          }

          appManager.refresh();
          return true;
        }

        log("[TuxDock] Tipo de source no soportado");
        return false;
      },

      handleDragOver: (source, actor, x, y, time) => {
        if (source.app) {
          // Highlight visual del dock cuando se puede agregar
          container.add_style_pseudo_class('drop-target');
          container.opacity = 200; // Ligeramente más visible
          return DND.DragMotionResult.COPY_DROP;
        }
        return DND.DragMotionResult.CONTINUE;
      },
    };

    // Limpiar highlight cuando el drag sale del dock
    container.connect('leave-event', () => {
      container.remove_style_pseudo_class('drop-target');
      container.opacity = 255;
    });

    log("[TuxDock] Drop target configurado");
  }

  _showAddedFeedback(container) {
    // Pulso visual para confirmar que se agregó
    container.ease({
      scale_x: 1.05,
      scale_y: 1.05,
      duration: 150,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        container.ease({
          scale_x: 1.0,
          scale_y: 1.0,
          duration: 150,
          mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
      },
    });
  }

  _handleFolderDrop(uri, appManager) {
    try {
      const file = Gio.File.new_for_uri(uri);
      const info = file.query_info(
        "standard::type",
        Gio.FileQueryInfoFlags.NONE,
        null
      );

      if (info.get_file_type() === Gio.FileType.DIRECTORY) {
        const settings = appManager._settings;
        const pinnedFolders = settings.getPinnedFolders();

        if (!pinnedFolders.includes(uri)) {
          pinnedFolders.push(uri);
          settings.setPinnedFolders(pinnedFolders);

          const folderName = file.get_basename();
          appManager.addStack(uri, folderName);

          log(`Carpeta ${folderName} añadida al dock`);
          return true;
        }
      }

      return false;
    } catch (e) {
      logError("Error manejando drop de carpeta", e);
      return false;
    }
  }

  /**
   * Configurar un icono de app para aceptar drops de archivos
   */
  setupFileDropTarget(appIcon) {
    const actor = appIcon.getActor();
    if (!actor) return;

    const originalDelegate = actor._delegate || {};

    actor._delegate = {
      ...originalDelegate,

      acceptDrop: (source, targetActor, x, y, time) => {
        if (source._fileUri) {
          return this._openFileWithApp(appIcon.app, source._fileUri);
        }

        if (originalDelegate.acceptDrop) {
          return originalDelegate.acceptDrop(source, targetActor, x, y, time);
        }

        return false;
      },

      handleDragOver: (source, targetActor, x, y, time) => {
        if (source._fileUri) {
          targetActor.add_style_pseudo_class("drop-target");
          return DND.DragMotionResult.COPY_DROP;
        }

        if (originalDelegate.handleDragOver) {
          return originalDelegate.handleDragOver(
            source,
            targetActor,
            x,
            y,
            time
          );
        }

        return DND.DragMotionResult.CONTINUE;
      },

      getDragActor: originalDelegate.getDragActor,
      getDragActorSource: originalDelegate.getDragActorSource,
      app: originalDelegate.app || appIcon.app,
    };
  }

  _openFileWithApp(app, fileUri) {
    try {
      const file = Gio.File.new_for_uri(fileUri);
      const context = global.create_app_launch_context(0, -1);

      app.launch([file], context);

      log(`Archivo ${fileUri} abierto con ${app.get_name()}`);
      return true;
    } catch (e) {
      logError(`Error abriendo archivo con ${app.get_name()}`, e);
      return false;
    }
  }

  destroy() {
    this._cleanupDragMonitor();
  }
}
