import Clutter from 'gi://Clutter';

/**
 * Maneja el efecto de ampliación estilo macOS
 * Los iconos se agrandan cuando el cursor está cerca, sin parpadeos
 */
export class MagnificationEffect {
    constructor(container, settings) {
        this._container = container;
        this._settings = settings;
        this._icons = [];
        this._motionEventId = null;
        this._leaveEventId = null;
        this._lastUpdateTime = 0;
        this._updateThrottle = 16; // ~60fps
        this._isDragging = false;
        
        // Configuración de ampliación
        this._maxScale = this._settings.getMagnificationScale();
        this._influenceRadius = 120; // Radio de influencia en píxeles
        this._curveSteepness = 2.5; // Intensidad de la curva de caída
    }

    enable() {
        if (!this._container) return;
        
        this._maxScale = this._settings.getMagnificationScale();

        // Conectar eventos de movimiento del mouse
        this._motionEventId = this._container.connect('motion-event', (actor, event) => {
            this._onMotion(event);
            return Clutter.EVENT_PROPAGATE;
        });

        this._leaveEventId = this._container.connect('leave-event', () => {
            this._onLeave();
            return Clutter.EVENT_PROPAGATE;
        });
    }

    registerIcon(iconActor) {
        if (!iconActor) return;
        
        const iconData = {
            actor: iconActor,
            currentScale: 1,
        };
        
        this._icons.push(iconData);
    }

    clearIcons() {
        this._icons.forEach(iconData => {
            if (iconData.actor) {
                this._resetIcon(iconData);
            }
        });
        this._icons = [];
    }

    _onMotion(event) {
        if (this._icons.length === 0) return;

        // Skip if dragging
        if (this._isDragging) {
            return;
        }

        // Throttling (60fps)
        const now = Date.now();
        if (now - this._lastUpdateTime < this._updateThrottle) {
            return;
        }
        this._lastUpdateTime = now;

        const [mouseX, mouseY] = event.get_coords();
        const dockPosition = this._settings.getPosition();
        
        // Calcular escalas para todos los iconos
        this._icons.forEach((iconData) => {
            const actor = iconData.actor;
            if (!actor) return;
            
            // Obtener posición del centro del icono
            const [iconX, iconY] = actor.get_transformed_position();
            const iconWidth = actor.width;
            const iconHeight = actor.height;
            const iconCenterX = iconX + iconWidth / 2;
            const iconCenterY = iconY + iconHeight / 2;
            
            // Calcular distancia del cursor al centro del icono
            const dx = mouseX - iconCenterX;
            const dy = mouseY - iconCenterY;
            const distance = Math.hypot(dx, dy);
            
            // Calcular escala usando curva Gaussiana
            let targetScale = 1;
            
            if (distance < this._influenceRadius) {
                const sigma = this._influenceRadius / this._curveSteepness;
                const normalizedDist = distance / sigma;
                const influence = Math.exp(-(normalizedDist * normalizedDist) / 2);
                targetScale = 1 + (this._maxScale - 1) * influence;
            }
            
            // Aplicar escala solo si hay cambio significativo (evita parpadeos)
            const scaleDiff = Math.abs(targetScale - iconData.currentScale);
            if (scaleDiff > 0.05) { // Threshold aumentado para evitar parpadeo
                iconData.currentScale = targetScale;
                this._applyScale(iconData, targetScale, dockPosition);
            }
        });
    }

    _applyScale(iconData, targetScale, dockPosition) {
        const actor = iconData.actor;
        if (!actor) return;

        // Remover transiciones previas
        actor.remove_all_transitions();

        // Ajustar pivot point según posición del dock
        if (dockPosition === 'BOTTOM') {
            actor.set_pivot_point(0.5, 1); // Escalar desde abajo-centro
        } else if (dockPosition === 'LEFT') {
            actor.set_pivot_point(0, 0.5); // Escalar desde izquierda-centro
        } else if (dockPosition === 'RIGHT') {
            actor.set_pivot_point(1, 0.5); // Escalar desde derecha-centro
        }

        // Aplicar escala directamente sin animación (más fluido)
        actor.set_scale(targetScale, targetScale);
        
        // NO aplicar translación vertical - los iconos escalan en su lugar
    }

    _onLeave() {
        // Resetear todos los iconos cuando el cursor sale
        this._icons.forEach(iconData => {
            if (iconData.actor) {
                this._resetIcon(iconData);
            }
        });
    }

    _resetIcon(iconData) {
        const actor = iconData.actor;
        if (!actor) return;
        
        actor.remove_all_transitions();
        actor.set_scale(1, 1);
        actor.translation_x = 0;
        actor.translation_y = 0;
        
        iconData.currentScale = 1;
    }

    setMaxScale(scale) {
        this._maxScale = Math.max(1, Math.min(3, scale));
    }

    setInfluenceRadius(radius) {
        this._influenceRadius = Math.max(50, Math.min(300, radius));
    }

    setDragging(isDragging) {
        this._isDragging = isDragging;
        
        if (isDragging) {
            // Durante el drag, resetear todos los iconos
            this._icons.forEach(iconData => {
                if (iconData.actor) {
                    this._resetIcon(iconData);
                }
            });
        }
    }

    disable() {
        if (this._motionEventId && this._container) {
            this._container.disconnect(this._motionEventId);
            this._motionEventId = null;
        }

        if (this._leaveEventId && this._container) {
            this._container.disconnect(this._leaveEventId);
            this._leaveEventId = null;
        }

        this._icons.forEach(iconData => {
            if (iconData.actor) {
                this._resetIcon(iconData);
            }
        });

        this._icons = [];
    }
}
