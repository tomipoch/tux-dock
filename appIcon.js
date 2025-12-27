import St from 'gi://St';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { AppContextMenu } from './contextMenu.js';
import { WindowPreview } from './windowPreview.js';
import { DockSettings } from './settings.js';
import { DockAnimations } from './animations.js';

/**
 * Representa un icono de aplicación en el dock
 * Maneja la creación del icono, eventos y estados visuales
 */
export class AppIcon {
    constructor(app, windowTracker, iconSize = 48) {
        this.app = app;
        this._windowTracker = windowTracker;
        this._button = null;
        this._container = null;
        this._iconSize = iconSize;
        this._menu = null;
        this._indicators = null;
        this._preview = new WindowPreview();
        this._previewTimeoutId = null;
        this._badge = null;
        this._badgeCount = 0;
        this._settings = new DockSettings();
        this._animations = new DockAnimations();
        this._wasRunning = false;
        this._draggable = null;
        this._tooltip = null;
        this._tooltipTimeoutId = null;
    }

    build() {
        // Crear contenedor para icono + indicadores
        this._container = new St.BoxLayout({
            vertical: true,
            style_class: 'tux-dock-icon-container',
            x_align: Clutter.ActorAlign.CENTER,
        });

        // Crear botón para el icono
        this._button = new St.Button({
            style_class: 'tux-dock-app-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: false,
            y_expand: false,
        });

        this._button.set_style(`
            padding: 6px;
            margin: 0 2px;
            border-radius: 12px;
            transition-duration: 200ms;
        `);

        // Crear icono - usar St.Icon para mejor calidad en magnificación
        this._iconWidget = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
        });
        
        this._icon = new St.Icon({
            gicon: this.app.get_app_info().get_icon(),
            icon_size: this._iconSize,
        });
        
        this._iconWidget.add_child(this._icon);
        
        // Crear badge (inicialmente oculto)
        this._badge = new St.Label({
            style_class: 'tux-dock-badge',
            text: '',
            visible: false,
        });
        
        this._badge.set_style(`
            background-color: #e74c3c;
            color: white;
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 9pt;
            font-weight: bold;
            position: absolute;
            top: -5px;
            right: -5px;
        `);
        
        this._iconWidget.add_child(this._badge);
        this._button.set_child(this._iconWidget);

        // Crear contenedor de indicadores
        this._indicators = new St.BoxLayout({
            style_class: 'tux-dock-indicators',
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._indicators.set_style(`
            spacing: 4px;
            margin-top: 2px;
        `);

        // Crear tooltip para mostrar nombre de la app
        this._createTooltip();
        
        // Añadir al contenedor principal
        this._container.add_child(this._button);
        this._container.add_child(this._indicators);


        // Configurar drag & drop
        this._draggable = DND.makeDraggable(this._button);
        this._draggable._dragActorSource = this._button;
        
        // Configurar como drop target para reordenar
        this._button._delegate = {
            app: this.app,
            
            acceptDrop: (source, actor, x, y, time) => {
                // Si es otro icono de app, reordenar
                if (source._delegate && source._delegate.app) {
                    return this._handleReorder(source._delegate.app);
                }
                return false;
            },
            
            handleDragOver: (source, actor, x, y, time) => {
                // Mostrar que se puede reordenar
                if (source._delegate && source._delegate.app) {
                    this._button.add_style_pseudo_class('hover');
                    return DND.DragMotionResult.MOVE_DROP;
                }
                return DND.DragMotionResult.CONTINUE;
            }
        };

        // Actualizar estado visual
        this._updateVisualState();

        // Conectar eventos
        this._connectEvents();

        return this._container;
    }

    _updateVisualState() {
        if (!this._button || !this._indicators) return;

        const windows = this.app.get_windows();
        const isRunning = windows.length > 0;
        
        // Detectar si la app acaba de abrirse para hacer bounce
        if (isRunning && !this._wasRunning && this._settings.getEnableBounce()) {
            // La app acaba de abrirse, hacer bounce
            this._animations.bounceIcon(this._container, 2, 0.4);
        }
        this._wasRunning = isRunning;
        
        // Obtener configuraciones
        const showRunningIndicator = this._settings.getShowRunningIndicator();
        const showWindowCount = this._settings.getShowWindowCount();

        // Actualizar estilo del botón
        if (isRunning) {
            this._button.add_style_pseudo_class('active');
            this._button.set_style(this._button.get_style() + `
                background-color: rgba(255, 255, 255, 0.15);
            `);
        } else {
            this._button.remove_style_pseudo_class('active');
            this._button.set_style(`
                padding: 6px;
                margin: 0 2px;
                border-radius: 12px;
                transition-duration: 200ms;
            `);
        }

        // Actualizar indicadores
        this._indicators.remove_all_children();

        if (isRunning && showRunningIndicator) {
            if (showWindowCount) {
                // Mostrar múltiples puntos según número de ventanas
                const windowCount = Math.min(windows.length, 4); // Máximo 4 indicadores
                
                for (let i = 0; i < windowCount; i++) {
                    const dot = new St.Widget({
                        style_class: 'tux-dock-indicator-dot',
                        width: 5,
                        height: 5,
                    });
                    
                    dot.set_style(`
                        background-color: rgba(255, 255, 255, 0.8);
                        border-radius: 50%;
                    `);
                    
                    this._indicators.add_child(dot);
                }
            } else {
                // Mostrar solo un punto para indicar que está abierta
                const dot = new St.Widget({
                    style_class: 'tux-dock-indicator-dot',
                    width: 5,
                    height: 5,
                });
                
                dot.set_style(`
                    background-color: rgba(255, 255, 255, 0.8);
                    border-radius: 50%;
                `);
                
                this._indicators.add_child(dot);
            }
        }
    }

    _connectEvents() {
        if (!this._button) return;

        // Manejar todos los clics con button-press-event
        this._button.connect('button-press-event', (actor, event) => {
            const button = event.get_button();
            
            if (button === 1) { // Click izquierdo
                this._onClicked();
                return Clutter.EVENT_STOP;
            } else if (button === 3) { // Click derecho
                this._showContextMenu();
                return Clutter.EVENT_STOP;
            } else if (button === 2) { // Click medio
                this._onMiddleClick();
                return Clutter.EVENT_STOP;
            }
            
            return Clutter.EVENT_PROPAGATE;
        });

        // Scroll para cambiar entre ventanas
        this._button.connect('scroll-event', (actor, event) => {
            const direction = event.get_scroll_direction();
            const scrollAction = this._settings.getScrollAction();
            
            if (scrollAction === 'cycle-windows') {
                this._onScroll(direction);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Hover effect y tooltip
        this._button.connect('notify::hover', (btn) => {
            // Mostrar/ocultar tooltip
            if (btn.hover) {
                this._scheduleShowTooltip();
            } else {
                this._hideTooltip();
            }
            
            // Hover visual effect
            // La magnificación ya maneja el efecto visual
            // Solo cambiar el fondo sutilmente
            if (btn.hover) {
                const currentStyle = btn.get_style();
                if (!currentStyle.includes('transform')) {
                    btn.set_style(currentStyle + `
                        background-color: rgba(255, 255, 255, 0.05);
                    `);
                }
                
                // Mostrar preview si hay ventanas (incluyendo minimizadas)
                const windows = this.app.get_windows();
                if (windows.length > 0) {
                    // Verificar si hay ventanas minimizadas o múltiples ventanas
                    const hasMinimized = windows.some(w => w.minimized);
                    if (windows.length > 1 || hasMinimized) {
                        this._schedulePreview();
                    }
                }
            } else {
                const baseStyle = `
                    padding: 6px;
                    margin: 0 2px;
                    border-radius: 12px;
                    transition-duration: 200ms;
                `;
                const isRunning = this.app.get_n_windows() > 0;
                btn.set_style(baseStyle + (isRunning ? `
                    background-color: rgba(255, 255, 255, 0.15);
                ` : ''));
                
                // Ocultar preview
                this._cancelPreview();
                if (this._preview) {
                    this._preview.scheduleHide();
                }
            }
        });

        // Detectar cuando el cursor entra en el área del preview
        this._container.connect('leave-event', () => {
            if (this._preview) {
                this._preview.scheduleHide();
            }
        });
    }

    _schedulePreview() {
        if (this._previewTimeoutId) return;

        // Timeout de 3 segundos (3000ms) para mostrar preview
        this._previewTimeoutId = setTimeout(() => {
            if (this._preview && this._button.hover) {
                this._preview.show(this.app, this._container);
            }
            this._previewTimeoutId = null;
        }, 3000);
    }

    _cancelPreview() {
        if (this._previewTimeoutId) {
            clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }
    }

    _showContextMenu() {
        if (this._menu) {
            this._menu.close(false);
            this._menu.destroy();
            this._menu = null;
        }

        this._menu = new AppContextMenu(this._button, this.app);
        
        this._menu.open(true);
        
        // Capturar clics fuera del menú para cerrarlo
        this._clickOutsideId = global.stage.connect('button-press-event', (actor, event) => {
            if (!this._menu) return Clutter.EVENT_PROPAGATE;
            
            const [x, y] = event.get_coords();
            const menuActor = this._menu.actor;
            
            if (menuActor && !menuActor.contains(event.get_source())) {
                this._menu.close(false);
                return Clutter.EVENT_STOP;
            }
            
            return Clutter.EVENT_PROPAGATE;
        });
        
        // Destruir menú al cerrarse
        this._menu.connect('open-state-changed', (menu, open) => {
            if (!open && this._menu) {
                if (this._clickOutsideId) {
                    global.stage.disconnect(this._clickOutsideId);
                    this._clickOutsideId = null;
                }
                this._menu.destroy();
                this._menu = null;
            }
        });
    }

    _onClicked() {
        const windows = this.app.get_windows();
        const clickAction = this._settings.getClickAction();

        if (windows.length === 0) {
            // Abrir app si no está abierta y comenzar rebote continuo
            this.app.open_new_window(-1);
            
            // Iniciar rebote continuo si está habilitado
            if (this._settings.getEnableBounce()) {
                this._animations.bounceContinuous(this._button, this.app);
            }
        } else if (clickAction === 'minimize-or-focus') {
            // Minimizar o enfocar
            const focusedWindow = windows.find(w => w.has_focus());
            const minimizedWindow = windows.find(w => w.minimized);
            
            if (focusedWindow) {
                // Si hay una ventana enfocada, minimizarla
                focusedWindow.minimize();
            } else if (minimizedWindow) {
                // Si hay una ventana minimizada, restaurarla
                minimizedWindow.unminimize();
                minimizedWindow.activate(global.get_current_time());
            } else {
                // Si ninguna está enfocada ni minimizada, activar la primera
                windows[0].activate(global.get_current_time());
            }
        } else if (clickAction === 'previews' && windows.length > 1) {
            // Mostrar previsualizaciones
            if (this._preview) {
                this._preview.show(this.app, this._container);
            }
        } else {
            // focus-or-launch (por defecto)
            if (windows.length === 1) {
                const window = windows[0];
                if (window.has_focus()) {
                    window.minimize();
                } else {
                    window.activate(global.get_current_time());
                }
            } else {
                // Múltiples ventanas: activar la primera
                windows[0].activate(global.get_current_time());
            }
        }
    }

    _onMiddleClick() {
        const middleClickAction = this._settings.getMiddleClickAction();
        const windows = this.app.get_windows();

        if (middleClickAction === 'new-window') {
            this.app.open_new_window(-1);
            
            // Rebote continuo si está habilitado y no hay ventanas
            if (windows.length === 0 && this._settings.getEnableBounce()) {
                this._animations.bounceContinuous(this._button, this.app);
            }
        } else if (middleClickAction === 'minimize') {
            windows.forEach(w => w.minimize());
        } else if (middleClickAction === 'quit') {
            this.app.request_quit();
        }
    }

    _onScroll(direction) {
        const windows = this.app.get_windows();
        if (windows.length === 0) return;

        // Encontrar ventana enfocada
        let currentIndex = windows.findIndex(w => w.has_focus());
        
        if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.LEFT) {
            // Ciclar hacia adelante
            currentIndex = (currentIndex + 1) % windows.length;
        } else if (direction === Clutter.ScrollDirection.DOWN || direction === Clutter.ScrollDirection.RIGHT) {
            // Ciclar hacia atrás
            currentIndex = (currentIndex - 1 + windows.length) % windows.length;
        }

        windows[currentIndex].activate(global.get_current_time());
    }

    getActor() {
        return this._container;
    }

    updateState() {
        this._updateVisualState();
    }

    /**
     * Actualizar el badge con un número
     */
    setBadgeCount(count) {
        this._badgeCount = count;
        
        if (!this._badge) return;
        
        if (count > 0) {
            this._badge.text = count > 99 ? '99+' : count.toString();
            this._badge.visible = true;
        } else {
            this._badge.visible = false;
        }
    }

    /**
     * Obtener el conteo actual del badge
     */
    getBadgeCount() {
        return this._badgeCount;
    }

    /**
     * Manejar reordenamiento de iconos
     */
    _handleReorder(sourceApp) {
        if (!sourceApp || sourceApp === this.app) return false;
        
        const favorites = AppFavorites.getAppFavorites();
        
        const sourceId = sourceApp.get_id();
        const targetId = this.app.get_id();
        
        // Obtener lista actual de favoritos
        const favoriteApps = favorites.getFavorites();
        const favoriteIds = favoriteApps.map(app => app.get_id());
        
        // Verificar que ambas apps estén en favoritos
        const sourceIndex = favoriteIds.indexOf(sourceId);
        const targetIndex = favoriteIds.indexOf(targetId);
        
        if (sourceIndex === -1) {
            // Si la app arrastrada no está en favoritos, agregarla antes del target
            favorites.addFavorite(sourceId);
            // Luego moverla a la posición correcta
            setTimeout(() => {
                const newFavorites = favorites.getFavorites();
                const newIds = newFavorites.map(app => app.get_id());
                const newSourceIndex = newIds.indexOf(sourceId);
                const newTargetIndex = newIds.indexOf(targetId);
                
                if (newSourceIndex !== -1 && newTargetIndex !== -1) {
                    favorites.moveFavoriteToPos(sourceId, newTargetIndex);
                }
            }, 100);
            return true;
        }
        
        if (targetIndex === -1) return false;
        
        // Reordenar moviendo el source a la posición del target
        favorites.moveFavoriteToPos(sourceId, targetIndex);
        
        log(`[TuxDock] Reordenado: ${sourceId} a posición ${targetIndex}`);
        return true;
    }

    _createTooltip() {
        // Crear label para el tooltip
        this._tooltip = new St.Label({
            text: this.app.get_name(),
            style_class: 'tux-dock-tooltip',
        });
        
        this._tooltip.set_style(`
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 10pt;
        `);
        
        this._tooltip.opacity = 0;
        this._tooltip.hide();
        
        Main.layoutManager.addChrome(this._tooltip);
    }

    _scheduleShowTooltip() {
        // Cancelar timeout previo
        if (this._tooltipTimeoutId) {
            clearTimeout(this._tooltipTimeoutId);
        }
        
        // Mostrar tooltip después de 500ms
        this._tooltipTimeoutId = setTimeout(() => {
            this._showTooltip();
            this._tooltipTimeoutId = null;
        }, 500);
    }

    _showTooltip() {
        if (!this._tooltip || !this._button) return;
        
        // Calcular posición encima del icono
        const [x, y] = this._button.get_transformed_position();
        const buttonWidth = this._button.width;
        const buttonHeight = this._button.height;
        
        // Posicionar tooltip centrado encima del botón
        this._tooltip.set_position(
            Math.floor(x + buttonWidth / 2 - this._tooltip.width / 2),
            Math.floor(y - this._tooltip.height - 8)
        );
        
        this._tooltip.show();
        this._tooltip.ease({
            opacity: 255,
            duration: 150,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _hideTooltip() {
        // Cancelar timeout pendiente
        if (this._tooltipTimeoutId) {
            clearTimeout(this._tooltipTimeoutId);
            this._tooltipTimeoutId = null;
        }
        
        if (!this._tooltip) return;
        
        this._tooltip.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (this._tooltip) {
                    this._tooltip.hide();
                }
            }
        });
    }

    destroy() {
        // Cancelar preview pendiente
        this._cancelPreview();
        
        // Detener rebotes continuos
        if (this._animations && this._button) {
            this._animations.stopContinuousBounce(this._button);
        }
        
        // Limpiar draggable
        if (this._draggable) {
            this._draggable = null;
        }
        
        if (this._preview) {
            this._preview.destroy();
            this._preview = null;
        }
        
        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }
        
        // Limpiar tooltip
        if (this._tooltipTimeoutId) {
            clearTimeout(this._tooltipTimeoutId);
            this._tooltipTimeoutId = null;
        }
        
        if (this._tooltip) {
            Main.layoutManager.removeChrome(this._tooltip);
            this._tooltip.destroy();
            this._tooltip = null;
        }
        
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
        
        this._button = null;
        this._indicators = null;
        this._badge = null;
    }
}
