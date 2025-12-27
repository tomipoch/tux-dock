import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { log, logError } from './utils.js';

/**
 * Maneja el arrastrar y soltar de iconos en el dock
 */
export class DragDropHandler {
    constructor(appManager) {
        this._appManager = appManager;
        this._dragMonitor = null;
    }

    makeDraggable(appIcon) {
        const actor = appIcon.getActor();
        if (!actor) return;

        // Crear delegate con información de la app
        actor._delegate = {
            app: appIcon.app,
            
            getDragActor: () => {
                return appIcon.app.create_icon_texture(48);
            },
            
            getDragActorSource: () => {
                return actor;
            },
            
            acceptDrop: (source, actor, x, y, time) => {
                // Permitir reordenamiento
                if (source.app && source !== actor._delegate) {
                    log('[TuxDock] Reordenando iconos');
                    return this._handleReorder(source.app, appIcon.app);
                }
                return false;
            },
            
            handleDragOver: (source, actor, x, y, time) => {
                if (source.app) {
                    return DND.DragMotionResult.MOVE_DROP;
                }
                return DND.DragMotionResult.CONTINUE;
            }
        };

        // Hacer draggable con opciones específicas
        const draggable = DND.makeDraggable(actor, {
            restoreOnSuccess: false,
            manualMode: false,
            dragActorMaxSize: 48,
        });
        
        draggable.connect('drag-begin', () => {
            actor.opacity = 100;
            log('[TuxDock] Drag comenzado');
        });
        
        draggable.connect('drag-end', () => {
            actor.opacity = 255;
            this._onDragEnd(appIcon);
            log('[TuxDock] Drag terminado');
        });

        actor._appIcon = appIcon;
        actor._draggable = draggable;
    }

    _onDragEnd(appIcon) {
        // Forzar refresh para reorganizar
        setTimeout(() => {
            this._appManager.refresh();
        }, 100);
    }

    _handleReorder(sourceApp, targetApp) {
        try {
            const favorites = AppFavorites.getAppFavorites();
            const favIds = favorites.getFavoriteMap();
            const ids = Object.keys(favIds);
            
            const sourceId = sourceApp.get_id();
            const targetId = targetApp.get_id();
            
            const sourceIndex = ids.indexOf(sourceId);
            const targetIndex = ids.indexOf(targetId);
            
            if (sourceIndex !== -1 && targetIndex !== -1) {
                // Remover el source
                ids.splice(sourceIndex, 1);
                // Insertar en la nueva posición
                const newTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
                ids.splice(newTargetIndex, 0, sourceId);
                
                // Actualizar favoritos
                favorites.setFavorites(ids);
                log(`[TuxDock] Apps reordenadas: ${sourceId} -> posición ${newTargetIndex}`);
                
                return true;
            }
            
            return false;
        } catch (e) {
            logError('Error reordenando iconos', e);
            return false;
        }
    }

    setupDropTarget(container, appManager) {
        if (!container) return;

        // Hacer el contenedor receptivo a drops
        container.reactive = true;
        container.track_hover = true;

        container._delegate = {
            acceptDrop: (source, actor, x, y, time) => {
                log('[TuxDock] acceptDrop llamado');
                
                // Si es un icono de app desde el lanzador, fijarlo
                if (source.app) {
                    log(`[TuxDock] Fijando app: ${source.app.get_name()}`);
                    const favorites = AppFavorites.getAppFavorites();
                    const appId = source.app.get_id();
                    
                    // Verificar si ya está en favoritos
                    if (!favorites.isFavorite(appId)) {
                        favorites.addFavorite(appId);
                        log(`[TuxDock] App ${appId} añadida a favoritos`);
                    }
                    
                    appManager.refresh();
                    return true;
                }
                
                log('[TuxDock] Tipo de source no soportado');
                return false;
            },
            
            handleDragOver: (source, actor, x, y, time) => {
                // Mostrar que se puede soltar
                if (source.app) {
                    return DND.DragMotionResult.COPY_DROP;
                }
                return DND.DragMotionResult.CONTINUE;
            }
        };
        
        log('[TuxDock] Drop target configurado');
    }
    
    _handleFolderDrop(uri, appManager) {
        try {
            // Verificar si es una carpeta
            const file = Gio.File.new_for_uri(uri);
            const info = file.query_info('standard::type', Gio.FileQueryInfoFlags.NONE, null);
            
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                // Es una carpeta, añadirla a pinned-folders
                const settings = appManager._settings;
                const pinnedFolders = settings.getPinnedFolders();
                
                if (!pinnedFolders.includes(uri)) {
                    pinnedFolders.push(uri);
                    settings.setPinnedFolders(pinnedFolders);
                    
                    // Crear stack icon para la carpeta
                    const folderName = file.get_basename();
                    appManager.addStack(uri, folderName);
                    
                    log(`Carpeta ${folderName} añadida al dock`);
                    return true;
                }
            }
            
            return false;
        } catch (e) {
            logError('Error manejando drop de carpeta', e);
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
            
            acceptDrop: (source, actor, x, y, time) => {
                // Si es un archivo, abrirlo con esta app
                if (source._fileUri) {
                    return this._openFileWithApp(appIcon.app, source._fileUri);
                }
                
                // Si es otra cosa, usar el delegate original
                if (originalDelegate.acceptDrop) {
                    return originalDelegate.acceptDrop(source, actor, x, y, time);
                }
                
                return false;
            },
            
            handleDragOver: (source, actor, x, y, time) => {
                // Aceptar archivos
                if (source._fileUri) {
                    actor.add_style_pseudo_class('drop-target');
                    return DND.DragMotionResult.COPY_DROP;
                }
                
                // Delegar al original
                if (originalDelegate.handleDragOver) {
                    return originalDelegate.handleDragOver(source, actor, x, y, time);
                }
                
                return DND.DragMotionResult.CONTINUE;
            },
            
            // Preservar otros métodos del delegate original
            getDragActor: originalDelegate.getDragActor,
            getDragActorSource: originalDelegate.getDragActorSource
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
}
