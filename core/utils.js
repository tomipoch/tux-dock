/**
 * Utilidades puras para Tux-Dock
 */

const LOG_PREFIX = '[TuxDock]';

/**
 * Log con prefijo
 */
export function log(message) {
    console.log(`${LOG_PREFIX} ${message}`);
}

/**
 * Log de error con prefijo
 */
export function logError(message, error) {
    console.error(`${LOG_PREFIX} ${message}`, error);
}

/**
 * Limitar valor entre min y max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Interpolación lineal
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Easing In-Out Cubic
 */
export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Smooth step (Hermite interpolation)
 */
export function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

/**
 * Comparar dos arrays para igualdad
 */
export function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
