import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

/**
 * Maneja animaciones del dock (rebotes, entradas, salidas)
 */
export class DockAnimations {
    constructor() {
        this._bounceAnimations = new Map();
        this._continuousBounces = new Map(); // Para rebotes continuos hasta que se abra ventana
        this._windowTracker = Shell.WindowTracker.get_default();
    }

    /**
     * Anima un rebote (bounce) en un icono
     * Útil para notificaciones o cuando se abre una app
     */
    bounceIcon(actor, bounces = 3, intensity = 0.3) {
        if (!actor) return;

        // Cancelar animación previa si existe y resetear posición completamente
        const existingAnimation = this._bounceAnimations.get(actor);
        if (existingAnimation) {
            actor.remove_all_transitions();
            actor.translation_y = 0;
            actor.translation_x = 0;
            actor.scale_x = 1.0;
            actor.scale_y = 1.0;
            this._bounceAnimations.delete(actor);
        }
        
        // Guardar escala original para restaurar después
        const originalScaleX = actor.scale_x;
        const originalScaleY = actor.scale_y;

        let currentBounce = 0;
        const bounceDuration = 150;
        const originalIntensity = intensity;

        const doBounce = () => {
            if (currentBounce >= bounces) {
                // Asegurar que termina en posición 0 de forma forzada
                actor.remove_all_transitions();
                actor.translation_y = 0;
                actor.translation_x = 0;
                actor.scale_x = originalScaleX;
                actor.scale_y = originalScaleY;
                this._bounceAnimations.delete(actor);
                return;
            }

            // Rebote hacia arriba
            actor.ease({
                translation_y: -30 * intensity,
                duration: bounceDuration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    // Caída
                    actor.ease({
                        translation_y: 0,
                        duration: bounceDuration,
                        mode: Clutter.AnimationMode.EASE_IN_QUAD,
                        onComplete: () => {
                            currentBounce++;
                            if (currentBounce < bounces) {
                                // Reducir intensidad en cada rebote
                                intensity *= 0.6;
                                setTimeout(() => doBounce(), 50);
                            } else {
                                // Asegurar posición final de forma forzada
                                actor.remove_all_transitions();
                                actor.translation_y = 0;
                                actor.translation_x = 0;
                                actor.scale_x = originalScaleX;
                                actor.scale_y = originalScaleY;
                                this._bounceAnimations.delete(actor);
                            }
                        }
                    });
                }
            });
        };

        this._bounceAnimations.set(actor, { bouncing: true, originalIntensity });
        doBounce();
    }
    
    /**
     * Rebote continuo hasta que la app abra una ventana
     */
    bounceContinuous(actor, app, intensity = 0.4) {
        if (!actor || !app) return;
        
        // Si ya está rebotando continuamente, no hacer nada
        if (this._continuousBounces.has(actor)) return;
        
        // Verificar si la app ya tiene ventanas
        if (app.get_n_windows() > 0) return;
        
        // Guardar escala original
        const originalScaleX = actor.scale_x;
        const originalScaleY = actor.scale_y;
        
        const bounceDuration = 200;
        let isBouncing = true;
        
        const doBounce = () => {
            if (!isBouncing) {
                actor.remove_all_transitions();
                actor.translation_y = 0;
                actor.translation_x = 0;
                actor.scale_x = originalScaleX;
                actor.scale_y = originalScaleY;
                this._continuousBounces.delete(actor);
                return;
            }
            
            // Rebote hacia arriba
            actor.ease({
                translation_y: -35 * intensity,
                duration: bounceDuration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (!isBouncing) return;
                    // Caída
                    actor.ease({
                        translation_y: 0,
                        duration: bounceDuration,
                        mode: Clutter.AnimationMode.EASE_IN_QUAD,
                        onComplete: () => {
                            if (isBouncing) {
                                setTimeout(() => doBounce(), 100);
                            }
                        }
                    });
                }
            });
        };
        
        // Usar un intervalo para verificar si se abrió una ventana
        const checkInterval = setInterval(() => {
            if (app.get_n_windows() > 0) {
                // La app abrió una ventana, detener rebote
                isBouncing = false;
                clearInterval(checkInterval);
                actor.remove_all_transitions();
                actor.translation_y = 0;
                actor.translation_x = 0;
                actor.scale_x = originalScaleX;
                actor.scale_y = originalScaleY;
                this._continuousBounces.delete(actor);
            }
        }, 100);
        
        this._continuousBounces.set(actor, { 
            isBouncing: true, 
            checkInterval, 
            originalScaleX, 
            originalScaleY 
        });
        
        doBounce();
    }
    
    /**
     * Detener rebote continuo manualmente
     */
    stopContinuousBounce(actor) {
        const bounceData = this._continuousBounces.get(actor);
        if (bounceData) {
            if (bounceData.checkInterval) {
                clearInterval(bounceData.checkInterval);
            }
            actor.remove_all_transitions();
            actor.translation_y = 0;
            actor.translation_x = 0;
            actor.scale_x = bounceData.originalScaleX || 1.0;
            actor.scale_y = bounceData.originalScaleY || 1.0;
            this._continuousBounces.delete(actor);
        }
    }

    /**
     * Animación de entrada para nuevos iconos
     */
    iconEnter(actor) {
        if (!actor) return;

        // Empezar invisible y pequeño
        actor.opacity = 0;
        actor.scale_x = 0.3;
        actor.scale_y = 0.3;
        actor.set_pivot_point(0.5, 0.5);

        // Animar entrada
        actor.ease({
            opacity: 255,
            scale_x: 1.0,
            scale_y: 1.0,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
        });
    }

    /**
     * Animación de salida para iconos que se eliminan
     */
    iconExit(actor, onComplete) {
        if (!actor) {
            if (onComplete) onComplete();
            return;
        }

        actor.ease({
            opacity: 0,
            scale_x: 0.3,
            scale_y: 0.3,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_IN_BACK,
            onComplete: () => {
                if (onComplete) onComplete();
            }
        });
    }

    /**
     * Animación de pulso para indicar actividad
     */
    pulseIcon(actor, duration = 300) {
        if (!actor) return;

        actor.ease({
            scale_x: 1.15,
            scale_y: 1.15,
            duration: duration / 2,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                actor.ease({
                    scale_x: 1.0,
                    scale_y: 1.0,
                    duration: duration / 2,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                });
            }
        });
    }

    /**
     * Animación de entrada del dock completo
     */
    dockEnter(container) {
        if (!container) return;

        container.translation_y = 100;
        container.opacity = 0;

        container.ease({
            translation_y: 0,
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    /**
     * Detener todas las animaciones en un actor
     */
    stopAllAnimations(actor) {
        if (!actor) return;

        actor.remove_all_transitions();
        actor.opacity = 255;
        actor.scale_x = 1.0;
        actor.scale_y = 1.0;
        actor.translation_y = 0;
        
        this._bounceAnimations.delete(actor);
    }

    cleanup() {
        this._bounceAnimations.clear();
    }
}

/**
 * Gestor de notificaciones para rebotes
 * Detecta cuando una app necesita atención y hace rebotar su icono
 */
export class NotificationBouncer {
    constructor(appManager, animations) {
        this._appManager = appManager;
        this._animations = animations;
        this._signalIds = [];
        this._windowTracker = Shell.WindowTracker.get_default();
    }

    enable() {
        // Conectar señal para detectar ventanas que demandan atención
        this._signalIds.push(
            global.display.connect('window-demands-attention', (display, window) => {
                this._onWindowDemandsAttention(window);
            })
        );

        // Detectar cuando una app se inicia
        this._signalIds.push(
            this._windowTracker.connect('tracked-windows-changed', () => {
                // Implementar lógica de rebote para apps nuevas si es necesario
            })
        );
    }

    _onWindowDemandsAttention(window) {
        if (!window) return;

        // Obtener la app asociada a la ventana
        const app = this._windowTracker.get_window_app(window);
        if (!app) return;

        // Buscar el icono de esta app en el dock
        const iconData = this._appManager._appIcons.get(app.get_id());
        if (iconData && iconData.getActor) {
            const actor = iconData.getActor();
            if (actor) {
                // Hacer rebotar el icono
                this._animations.bounceIcon(actor, 3, 0.5);
            }
        }
    }

    disable() {
        this._signalIds.forEach(id => {
            try {
                global.display.disconnect(id);
            } catch (e) {
                try {
                    this._windowTracker.disconnect(id);
                } catch (e2) {
                    // Ignorar
                }
            }
        });
        this._signalIds = [];
    }
}
