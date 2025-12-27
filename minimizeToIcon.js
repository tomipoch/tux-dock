import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { DockSettings } from './settings.js';

/**
 * Maneja animaciones de minimizar/restaurar ventanas hacia/desde iconos
 */
export class MinimizeToIcon {
    constructor(dockContainer, appManager) {
        this._dockContainer = dockContainer;
        this._appManager = appManager;
        this._windowTracker = Shell.WindowTracker.get_default();
        this._settings = new DockSettings();
        this._signalIds = [];
    }

    enable() {
        // Solo conectar si está habilitado en configuración
        if (!this._settings.getMinimizeToDock()) {
            return;
        }

        // Conectar señales de minimizar/restaurar
        this._signalIds.push(
            global.window_manager.connect('minimize', (wm, actor) => {
                this._onMinimize(actor);
            })
        );

        this._signalIds.push(
            global.window_manager.connect('unminimize', (wm, actor) => {
                this._onUnminimize(actor);
            })
        );
    }

    _onMinimize(actor) {
        const window = actor.meta_window;
        const app = this._windowTracker.get_window_app(window);
        
        if (!app) return;

        // Buscar el icono correspondiente
        const iconData = this._appManager._appIcons.get(app.get_id());
        if (!iconData) return;

        const iconActor = iconData.getActor();
        if (!iconActor) return;

        // Obtener tipo de animación
        const animationType = this._settings.getMinimizeAnimation();
        
        if (animationType === 'none') {
            return;
        }

        // Guardar la posición original de la ventana
        const rect = window.get_frame_rect();
        if (!window._originalPosition) {
            window._originalPosition = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            };
        }

        // Obtener posiciones
        const [windowX, windowY] = actor.get_position();
        const windowWidth = actor.width;
        const windowHeight = actor.height;
        
        // Obtener la posición global del icono (incluyendo transformaciones)
        const [iconX, iconY] = iconActor.get_transformed_position();
        const iconWidth = iconActor.get_transformed_size()[0];
        const iconHeight = iconActor.get_transformed_size()[1];
        const iconCenterX = iconX + iconWidth / 2;
        const iconCenterY = iconY + iconHeight / 2;
        
        // Crear un clone del actor
        const clone = new Clutter.Clone({
            source: actor,
            x: windowX,
            y: windowY,
            width: windowWidth,
            height: windowHeight,
        });

        Main.uiGroup.add_child(clone);
        
        // Ocultar ventana original inmediatamente
        actor.hide();

        if (animationType === 'genie') {
            // Efecto Magic Lamp (Aladino) de macOS - distorsión fluida tipo succión
            clone.set_pivot_point(0.5, 1.0);
            
            // Variables para el efecto
            const duration = 300;
            const steps = 6; // Múltiples pasos para crear la curva
            const stepDuration = duration / steps;
            
            // Función para interpolar con curva suave
            const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            let step = 0;
            const animate = () => {
                if (step >= steps) {
                    clone.destroy();
                    return;
                }
                
                const progress = (step + 1) / steps;
                const easedProgress = easeInOutQuad(progress);
                
                // Calcular posición intermedia con curva - apuntar al centro del icono
                const currentX = windowX + (iconCenterX - windowX - windowWidth / 2) * easedProgress;
                const currentY = windowY + (iconCenterY - windowY - windowHeight / 2) * easedProgress;
                
                // Distorsión progresiva: la parte inferior se estrecha más rápido
                const bottomNarrow = Math.pow(easedProgress, 1.5);
                
                // Simular efecto de succión con escalado asimétrico
                const scaleX = Math.max(0.05, 1 - bottomNarrow);
                const scaleY = Math.max(0.05, 1 - easedProgress * 0.9);
                
                // Ancho que se reduce más en la base (efecto embudo)
                const widthFactor = 1 - bottomNarrow * 0.95;
                const heightFactor = 1 - easedProgress * 0.95;
                
                clone.ease({
                    x: currentX,
                    y: currentY,
                    width: windowWidth * widthFactor,
                    height: windowHeight * heightFactor,
                    scale_x: scaleX,
                    scale_y: scaleY,
                    opacity: Math.max(50, 255 * (1 - easedProgress)),
                    duration: stepDuration,
                    mode: Clutter.AnimationMode.LINEAR,
                    onComplete: () => {
                        step++;
                        animate();
                    }
                });
            };
            
            animate();
        } else {
            // Animación simple de escala
            clone.set_pivot_point(0.5, 0.5);
            clone.ease({
                x: iconCenterX,
                y: iconCenterY,
                scale_x: 0.0,
                scale_y: 0.0,
                opacity: 0,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    clone.destroy();
                }
            });
        }
    }

    _onUnminimize(actor) {
        const window = actor.meta_window;
        const app = this._windowTracker.get_window_app(window);
        
        if (!app) return;

        // Buscar el icono correspondiente
        const iconData = this._appManager._appIcons.get(app.get_id());
        if (!iconData) return;

        const iconActor = iconData.getActor();
        if (!iconActor) return;

        // Obtener tipo de animación
        const animationType = this._settings.getMinimizeAnimation();
        
        if (animationType === 'none') {
            return;
        }

        // Obtener posiciones
        const [iconX, iconY] = iconActor.get_transformed_position();
        const iconCenterX = iconX + iconActor.width / 2;
        const iconCenterY = iconY + iconActor.height / 2;
        
        // Usar la posición original guardada si existe
        const originalPos = window._originalPosition;
        const targetRect = originalPos || window.get_frame_rect();

        // Asegurar que la ventana esté en su posición correcta antes de mostrarla
        if (originalPos) {
            window.move_frame(true, originalPos.x, originalPos.y);
        }

        // Crear un clone de la ventana
        const clone = new Clutter.Clone({
            source: actor,
            x: iconCenterX,
            y: iconCenterY,
            scale_x: 0.0,
            scale_y: 0.0,
            opacity: 0,
        });

        Main.uiGroup.add_child(clone);
        
        // Ocultar la ventana original temporalmente
        actor.opacity = 0;

        if (animationType === 'genie') {
            // Efecto Magic Lamp inverso de macOS
            clone.set_pivot_point(0.5, 1.0);
            clone.width = iconActor.width;
            clone.height = iconActor.height;
            clone.x = iconCenterX;
            clone.y = iconCenterY;
            
            const duration = 300;
            const steps = 6;
            const stepDuration = duration / steps;
            
            const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            let step = 0;
            const animate = () => {
                if (step >= steps) {
                    actor.opacity = 255;
                    actor.show();
                    clone.destroy();
                    
                    if (window._originalPosition) {
                        delete window._originalPosition;
                    }
                    return;
                }
                
                const progress = (step + 1) / steps;
                const easedProgress = easeInOutQuad(progress);
                
                // Expandir desde el icono hacia la ventana
                const currentX = iconCenterX + (targetRect.x - iconCenterX) * easedProgress;
                const currentY = iconCenterY + (targetRect.y - iconCenterY) * easedProgress;
                
                const widthFactor = easedProgress;
                const heightFactor = easedProgress;
                const scaleX = Math.min(1.0, 0.05 + easedProgress);
                const scaleY = Math.min(1.0, 0.05 + easedProgress);
                
                clone.ease({
                    x: currentX,
                    y: currentY,
                    width: targetRect.width * widthFactor,
                    height: targetRect.height * heightFactor,
                    scale_x: scaleX,
                    scale_y: scaleY,
                    opacity: Math.min(255, 50 + 205 * easedProgress),
                    duration: stepDuration,
                    mode: Clutter.AnimationMode.LINEAR,
                    onComplete: () => {
                        step++;
                        animate();
                    }
                });
            };
            
            animate();
        } else {
            // Animación simple de escala
            clone.set_pivot_point(0.5, 0.5);
            clone.ease({
                x: targetRect.x,
                y: targetRect.y,
                scale_x: 1.0,
                scale_y: 1.0,
                opacity: 255,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    // Mostrar la ventana original
                    actor.opacity = 255;
                    actor.show();
                    clone.destroy();
                    
                    // Limpiar la posición guardada
                    if (window._originalPosition) {
                        delete window._originalPosition;
                    }
                }
            });
        }
    }

    disable() {
        this._signalIds.forEach(id => {
            try {
                global.window_manager.disconnect(id);
            } catch (e) {
                // Ignorar
            }
        });
        this._signalIds = [];
    }
}
