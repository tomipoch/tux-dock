/**
 * Utilidades y constantes compartidas
 */

export const DockPosition = {
    BOTTOM: 0,
    LEFT: 1,
    RIGHT: 2,
};

export const DockSettings = {
    ICON_SIZE: 48,
    PADDING: 8,
    MARGIN: 8,
    BORDER_RADIUS: 16,
    ANIMATION_TIME: 200,
    BACKGROUND_COLOR: 'rgba(40, 40, 40, 0.9)',
};

/**
 * Calcula la posición del dock según el monitor y la configuración
 */
export function calculateDockPosition(container, monitor, position = DockPosition.BOTTOM) {
    const containerWidth = container.width || 400;
    const containerHeight = container.height || 70;

    switch (position) {
        case DockPosition.BOTTOM:
            return {
                x: monitor.x + Math.floor((monitor.width - containerWidth) / 2),
                y: monitor.y + monitor.height - containerHeight - DockSettings.MARGIN,
            };
        case DockPosition.LEFT:
            return {
                x: monitor.x + DockSettings.MARGIN,
                y: monitor.y + Math.floor((monitor.height - containerHeight) / 2),
            };
        case DockPosition.RIGHT:
            return {
                x: monitor.x + monitor.width - containerWidth - DockSettings.MARGIN,
                y: monitor.y + Math.floor((monitor.height - containerHeight) / 2),
            };
        default:
            return { x: 0, y: 0 };
    }
}

/**
 * Logger con prefijo para debugging
 */
export function log(message) {
    console.log(`[TuxDock] ${message}`);
}

export function logError(message, error) {
    console.error(`[TuxDock] ${message}`, error);
}
