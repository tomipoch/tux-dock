/**
 * Utilidades de performance para Tux-Dock
 */

import GLib from 'gi://GLib';

/**
 * Debounce: Retrasa la ejecución de una función hasta que hayan pasado N ms sin llamadas
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función debounced
 */
export function debounce(func, wait) {
    let timeoutId = null;

    return function (...args) {
        if (timeoutId) {
            GLib.source_remove(timeoutId);
        }

        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, wait, () => {
            func.apply(this, args);
            timeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    };
}

/**
 * Throttle: Limita la ejecución de una función a una vez cada N ms
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Tiempo mínimo entre ejecuciones en ms
 * @returns {Function} Función throttled
 */
export function throttle(func, limit) {
    let inThrottle = false;
    let lastArgs = null;
    let timeoutId = null;

    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, limit, () => {
                inThrottle = false;

                // Si hubo llamadas durante el throttle, ejecutar con los últimos args
                if (lastArgs) {
                    func.apply(this, lastArgs);
                    lastArgs = null;
                    inThrottle = true;

                    timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, limit, () => {
                        inThrottle = false;
                        timeoutId = null;
                        return GLib.SOURCE_REMOVE;
                    });
                }

                return GLib.SOURCE_REMOVE;
            });
        } else {
            lastArgs = args;
        }
    };
}

/**
 * RequestAnimationFrame equivalente para GNOME Shell
 * Ejecuta callback en el próximo frame
 * @param {Function} callback - Función a ejecutar
 * @returns {number} ID del timeout
 */
export function requestAnimationFrame(callback) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
        callback();
        return GLib.SOURCE_REMOVE;
    });
}

/**
 * Batch updates: Agrupa múltiples actualizaciones en una sola
 */
export class BatchUpdater {
    constructor() {
        this._pending = new Set();
        this._timeoutId = null;
    }

    /**
     * Programa una actualización
     * @param {string} key - Identificador único de la actualización
     * @param {Function} callback - Función a ejecutar
     */
    schedule(key, callback) {
        this._pending.set(key, callback);

        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
        }

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            this.flush();
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Ejecuta todas las actualizaciones pendientes
     */
    flush() {
        this._pending.forEach((callback) => callback());
        this._pending.clear();
        this._timeoutId = null;
    }

    /**
     * Limpia todas las actualizaciones pendientes
     */
    clear() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        this._pending.clear();
    }
}
