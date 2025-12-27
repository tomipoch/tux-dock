import Clutter from 'gi://Clutter';

/**
 * Maneja el efecto de ampliación estilo macOS
 * Los iconos se agrandan y el dock se expande cuando el cursor está cerca
 */
export class MagnificationEffect {
    constructor(container, settings) {
        this._container = container;
        this._settings = settings;
        this._icons = [];
        this._motionEventId = null;
        this._leaveEventId = null;
        this._animating = false;
        
        // Configuración de ampliación - cargar desde settings
        this._maxScale = this._settings.getMagnificationScale(); // Cargar escala guardada
        this._influenceRadius = 150; // Radio de influencia en píxeles
        this._animationDuration = 150; // Duración de animación en ms
        this._useHighRes = true; // Usar iconos de alta resolución
        this._baseSpacing = 8; // Espaciado base entre iconos
    }

    enable() {
        if (!this._container) return;
        
        // Actualizar escala desde settings al habilitar
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
        
        // Almacenar información del icono
        const iconData = {
            actor: iconActor,
            originalWidth: iconActor.width || 48,
            originalHeight: iconActor.height || 48,
            currentScale: 1.0,
        };
        
        // Buscar el St.Icon dentro de la jerarquía del actor
        // La estructura es: container -> button -> iconWidget -> St.Icon
        const findStIcon = (actor) => {
            if (!actor) return null;
            
            // Si es un St.Icon, devolverlo
            if (actor.constructor.name === 'StIcon') {
                return actor;
            }
            
            // Si tiene child, buscar ahí
            if (actor.child) {
                const found = findStIcon(actor.child);
                if (found) return found;
            }
            
            // Si tiene get_children, buscar en todos los hijos
            if (actor.get_children) {
                const children = actor.get_children();
                for (const child of children) {
                    const found = findStIcon(child);
                    if (found) return found;
                }
            }
            
            return null;
        };
        
        const stIcon = findStIcon(iconActor);
        if (stIcon && stIcon.icon_size) {
            iconData.iconWidget = stIcon;
            iconData.originalIconSize = stIcon.icon_size;
        }
        
        this._icons.push(iconData);
    }

    clearIcons() {
        // Resetear todos los iconos antes de limpiar
        this._icons.forEach(iconData => {
            if (iconData.actor) {
                this._animateIcon(iconData, 1.0, 0);
            }
        });
        this._icons = [];
    }

    _onMotion(event) {
        if (this._icons.length === 0) return;

        const [mouseX, mouseY] = event.get_coords();
        
        // Calcular escalas para todos los iconos directamente desde la posición del cursor
        this._icons.forEach((iconData, index) => {
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
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calcular escala basada en la distancia (curva suave tipo macOS)
            let targetScale = 1.0;
            
            if (distance < this._influenceRadius) {
                // Usar una curva parabólica para transición suave
                const normalizedDist = distance / this._influenceRadius;
                const influence = 1.0 - (normalizedDist * normalizedDist);
                targetScale = 1.0 + (this._maxScale - 1.0) * influence;
            }
            
            // Aplicar escala solo si hay cambio significativo (evita parpadeos)
            const scaleDiff = Math.abs(targetScale - iconData.currentScale);
            if (scaleDiff > 0.02) {
                iconData.currentScale = targetScale;
                this._applyScale(iconData, targetScale);
            }
        });
    }

    _onLeave() {
        // Resetear todos los iconos cuando el cursor sale del dock
        this._icons.forEach(iconData => {
            if (iconData.actor) {
                iconData.currentScale = 1.0;
                this._applyScale(iconData, 1.0);
            }
        });
    }

    _applyScale(iconData, targetScale) {
        const actor = iconData.actor;
        if (!actor) return;

        // Remover cualquier animación previa
        actor.remove_all_transitions();

        // Ajustar pivot point para que escale desde el centro inferior (efecto macOS)
        actor.set_pivot_point(0.5, 1.0);

        // Aplicar escala directamente sin animación (más fluido, sin parpadeos)
        actor.set_scale(targetScale, targetScale);
    }
    
    _animateIcon(iconData, targetScale, duration = this._animationDuration) {
        // Mantener por compatibilidad, pero usar _applyScale
        this._applyScale(iconData, targetScale);
    }

    setMaxScale(scale) {
        this._maxScale = Math.max(1.0, Math.min(3.0, scale));
    }

    setInfluenceRadius(radius) {
        this._influenceRadius = Math.max(50, Math.min(300, radius));
    }

    disable() {
        // Desconectar eventos
        if (this._motionEventId && this._container) {
            this._container.disconnect(this._motionEventId);
            this._motionEventId = null;
        }

        if (this._leaveEventId && this._container) {
            this._container.disconnect(this._leaveEventId);
            this._leaveEventId = null;
        }

        // Resetear iconos
        this._icons.forEach(iconData => {
            if (iconData.actor) {
                iconData.actor.remove_all_transitions();
                iconData.actor.set_scale(1.0, 1.0);
            }
        });

        this._icons = [];
    }
}
