import Clutter from 'gi://Clutter';

const FPS_DT = 1 / 60;

function lerp(a, b, t) {
    return a + (b - a) * t;
}

export class MagnificationEffect {
    constructor(container, settings) {
        this._container = container;
        this._settings = settings;

        this._icons = [];
        this._motionEventId = null;
        this._leaveEventId = null;

        this._maxScale = this._settings.getMagnificationScale();
        this._influenceRadius = 140;

        this._lastUpdateTime = 0;
        this._updateThrottle = 1000 / 60;

        this._isDragging = false;

        if (this._container) {
            this._container.reactive = true;
        }
    }

    enable() {
        if (!this._container) return;

        this._maxScale = this._settings.getMagnificationScale();

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

        // Evitar duplicados
        if (this._icons.find(i => i.actor === iconActor)) {
            return;
        }

        this._icons.push({
            actor: iconActor,
            currentScale: 1,
            currentShift: 0,
        });
    }

    clearIcons() {
        this._icons.forEach(iconData => this._resetIcon(iconData));
        this._icons = [];
    }

    setMaxScale(scale) {
        this._maxScale = scale;
    }

    /* ---------------- core macOS behaviour ---------------- */

    _onMotion(event) {
        if (this._icons.length === 0 || this._isDragging)
            return;

        const now = Date.now();
        if (now - this._lastUpdateTime < this._updateThrottle)
            return;
        this._lastUpdateTime = now;

        const [mouseX, mouseY] = event.get_coords();
        const dockPosition = this._settings.getPosition();

        /* 1D distance along dock axis */

        // First compute target scales
        this._icons.forEach(iconData => {
            const actor = iconData.actor;
            if (!actor)
                return;

            const [iconX, iconY] = actor.get_transformed_position();
            const cx = iconX + actor.width / 2;
            const cy = iconY + actor.height / 2;

            let dist1D;

            if (dockPosition === 'BOTTOM' || dockPosition === 'TOP')
                dist1D = Math.abs(mouseX - cx);
            else
                dist1D = Math.abs(mouseY - cy);

            /* macOS-like bicubic falloff kernel */

            const r = this._influenceRadius;
            let w = 0;

            if (dist1D < r) {
                const t = dist1D / r;
                w = Math.pow(Math.max(0, 1 - Math.pow(t, 3)), 3);
            }

            const targetScale = 1 + (this._maxScale - 1) * w;

            // smooth
            iconData.currentScale = lerp(iconData.currentScale, targetScale, 0.25);
        });

        /* -------------- dock stretch (neighbor shift) -------------- */

        let cumulativeShift = 0;

        this._icons.forEach(iconData => {
            const actor = iconData.actor;
            if (!actor)
                return;

            const scale = iconData.currentScale;

            const baseSize = dockPosition === 'BOTTOM' || dockPosition === 'TOP'
                ? actor.width
                : actor.height;

            const extra = (baseSize * scale - baseSize);

            cumulativeShift += extra * 0.5;

            // smooth translation
            iconData.currentShift = lerp(iconData.currentShift, cumulativeShift, 0.25);

            this._applyTransform(iconData, dockPosition);
        });
    }

    _applyTransform(iconData, dockPosition) {
        const actor = iconData.actor;
        if (!actor)
            return;

        const s = iconData.currentScale;
        const shift = iconData.currentShift;

        // pivot like macOS
        if (dockPosition === 'BOTTOM')
            actor.set_pivot_point(0.5, 1);
        else if (dockPosition === 'TOP')
            actor.set_pivot_point(0.5, 0);
        else if (dockPosition === 'LEFT')
            actor.set_pivot_point(0, 0.5);
        else if (dockPosition === 'RIGHT')
            actor.set_pivot_point(1, 0.5);

        // IMPORTANT: do not remove transitions every frame
        actor.set_scale(s, s);

        if (dockPosition === 'BOTTOM' || dockPosition === 'TOP') {
            actor.translation_x = shift;
            actor.translation_y = (1 - s) * actor.height * 0.35;
        } else {
            actor.translation_y = shift;
            actor.translation_x = (1 - s) * actor.width * 0.35;
        }
    }

    _onLeave() {
        this._icons.forEach(iconData => this._resetIcon(iconData));
    }

    _resetIcon(iconData) {
        const actor = iconData.actor;
        if (!actor)
            return;

        actor.set_scale(1, 1);
        actor.translation_x = 0;
        actor.translation_y = 0;

        iconData.currentScale = 1;
        iconData.currentShift = 0;
    }

    setDragging(isDragging) {
        this._isDragging = isDragging;

        if (isDragging)
            this._icons.forEach(iconData => this._resetIcon(iconData));
    }

    disable() {
        if (this._motionEventId && this._container)
            this._container.disconnect(this._motionEventId);

        if (this._leaveEventId && this._container)
            this._container.disconnect(this._leaveEventId);

        this._icons.forEach(iconData => this._resetIcon(iconData));
        this._icons = [];
    }
}
