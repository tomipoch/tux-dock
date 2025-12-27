import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { MagnificationEffect } from './magnification.js';

/**
 * Contenedor principal del dock
 * Maneja el layout, posición y apariencia del dock
 */
export class DockContainer {
    constructor(settings) {
        this._container = null;
        this._icons = [];
        this._settings = settings;
        this._magnification = null;
    }

    build() {
        // Crear contenedor principal del dock
        this._container = new St.BoxLayout({
            style_class: 'tux-dock-container',
            vertical: false,
            reactive: true,
            track_hover: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
        });

        // Aplicar estilo inicial
        this._updateStyle();

        // Añadir el dock al layout del shell
        Main.layoutManager.addChrome(this._container, {
            affectsStruts: false,
            trackFullscreen: true,
        });

        // Posicionar en la parte inferior central
        this.updatePosition();

        // Inicializar magnificación
        this._magnification = new MagnificationEffect(this._container, this._settings);
        this._magnification.enable();

        return this._container;
    }

    _updateStyle() {
        if (!this._container) return;

        const opacity = this._settings.getDockOpacity();
        const margin = this._settings.getDockMargin();
        
        this._container.set_style(`
            background-color: rgba(40, 40, 40, ${opacity});
            border-radius: 18px;
            padding: 10px 14px;
            margin-bottom: ${margin}px;
        `);
    }

    updatePosition() {
        if (!this._container) return;

        const monitor = Main.layoutManager.primaryMonitor;
        const position = this._settings.getPosition();
        const margin = this._settings.getDockMargin();
        
        // Remover todas las transiciones activas
        this._container.remove_all_transitions();
        
        if (position === 'BOTTOM') {
            this._container.vertical = false;
            // Esperar a que el layout se actualice
            this._container.queue_relayout();
            const timeoutId = setTimeout(() => {
                const containerWidth = this._container.width || 400;
                this._container.set_position(
                    monitor.x + Math.floor((monitor.width - containerWidth) / 2),
                    monitor.y + monitor.height - this._container.height - margin
                );
            }, 50);
        } else if (position === 'LEFT') {
            this._container.vertical = true;
            this._container.queue_relayout();
            const timeoutId = setTimeout(() => {
                const containerHeight = this._container.height || 70;
                this._container.set_position(
                    monitor.x + margin,
                    monitor.y + Math.floor((monitor.height - containerHeight) / 2)
                );
            }, 50);
        } else if (position === 'RIGHT') {
            this._container.vertical = true;
            this._container.queue_relayout();
            const timeoutId = setTimeout(() => {
                const containerHeight = this._container.height || 70;
                this._container.set_position(
                    monitor.x + monitor.width - this._container.width - margin,
                    monitor.y + Math.floor((monitor.height - containerHeight) / 2)
                );
            }, 50);
        }
    }

    addIcon(iconActor) {
        if (!this._container) return;
        
        // Animación de entrada suave
        iconActor.opacity = 0;
        iconActor.scale_x = 0.5;
        iconActor.scale_y = 0.5;
        
        this._container.add_child(iconActor);
        this._icons.push(iconActor);
        
        // Animar entrada
        iconActor.ease({
            opacity: 255,
            scale_x: 1.0,
            scale_y: 1.0,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                // Actualizar posición del dock después de la animación
                this.updatePosition();
            }
        });
        
        // Registrar icono en el sistema de magnificación
        if (this._magnification) {
            this._magnification.registerIcon(iconActor);
        }
    }

    clearIcons() {
        if (!this._container) return;
        
        // Limpiar magnificación primero
        if (this._magnification) {
            this._magnification.clearIcons();
        }
        
        this._container.remove_all_children();
        this._icons = [];
    }

    getContainer() {
        return this._container;
    }

    updateMagnification() {
        if (!this._magnification) return;
        
        const enabled = this._settings.getMagnificationEnabled();
        const scale = this._settings.getMagnificationScale();
        
        if (enabled) {
            this._magnification.setMaxScale(scale);
            this._magnification.enable();
        } else {
            this._magnification.disable();
        }
    }

    updateStyle() {
        this._updateStyle();
    }

    destroy() {
        // Desactivar magnificación
        if (this._magnification) {
            this._magnification.disable();
            this._magnification = null;
        }
        
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
        this._icons = [];
    }
}
