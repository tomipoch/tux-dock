import Clutter from 'gi://Clutter';
import { lerp } from '../core/utils.js';
import { Magnification, Spacing } from '../core/config.js';

export class MagnificationEffect {
    constructor(container, settings) {
        this._container = container;
        this._settings = settings;

        this._icons = [];
        this._motionEventId = null;
        this._leaveEventId = null;
        this._enterEventId = null;

        this._maxScale = this._settings.getMagnificationScale();
        this._influenceRadius = 250;

        this._lastUpdateTime = 0;
        this._updateThrottle = 1000 / 60;

        this._isDragging = false;

        if (this._container) {
            this._container.reactive = true;
        }

        this._baseGeometry = null;
    }

    enable() {
        if (!this._container) return;

        this._maxScale = this._settings.getMagnificationScale();

        // Use motion-event and PROPAGATE to not block events to child actors
        this._motionEventId = this._container.connect('motion-event', (actor, event) => {
            this._onMotion(event);
            return Clutter.EVENT_PROPAGATE;
        });

        this._leaveEventId = this._container.connect('leave-event', () => {
            this._onLeave();
            return Clutter.EVENT_PROPAGATE;
        });

        // Also track when mouse enters to ensure we capture motion from the start
        this._enterEventId = this._container.connect('enter-event', () => {
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

    /* ---------------- core macOS behaviour (Physical Layout) ---------------- */

    _onMotion(event) {
        if (this._icons.length === 0 || this._isDragging)
            return;

        const now = Date.now();
        if (now - this._lastUpdateTime < this._updateThrottle)
            return;
        this._lastUpdateTime = now;

        const [mouseX, mouseY] = event.get_coords();
        const dockPosition = this._settings.getPosition();
        const isHorizontal = (dockPosition === 'BOTTOM' || dockPosition === 'TOP');

        // Calculate Base Geometry robustly from content
        // This avoids capturing dirty state if the animation was interrupted
        const padding = 6; // Match dockContainer.js
        const spacing = 0; // Match dockContainer.js

        let baseContentSize = 0;
        this._icons.forEach(data => {
            if (data.actor) {
                baseContentSize += isHorizontal ? data.actor.width : data.actor.height;
            }
        });
        // Add spacing if any (count - 1)
        if (this._icons.length > 1) baseContentSize += (this._icons.length - 1) * spacing;

        const baseWidth = isHorizontal ? (baseContentSize + padding * 2) : this._container.width;
        const baseHeight = isHorizontal ? this._container.height : (baseContentSize + padding * 2);

        // Calculate Base Position (Centered)
        // We can't trust container.x because it might be shifted.
        // We know the dock is centered on the monitor (usually).
        // Let's rely on the container's *current center* being roughly correct?
        // No, if we shifted it left, the center moved.
        // But we shifted it left to KEEP the center constant relative to the expansion!
        // So (container.x + container.width / 2) SHOULD be the true center of the dock.

        const currentCenterX = this._container.x + this._container.width / 2;
        const currentCenterY = this._container.y + this._container.height / 2;

        const baseX = isHorizontal ? (currentCenterX - baseWidth / 2) : this._container.x;
        const baseY = isHorizontal ? this._container.y : (currentCenterY - baseHeight / 2);

        this._baseGeometry = {
            w: baseWidth,
            h: baseHeight,
            x: baseX,
            y: baseY
        };

        // 1. Calculate Scales & Dimensions
        const r = this._influenceRadius;
        let totalSize = 0;
        // spacing is already defined above

        const layoutData = this._icons.map(iconData => {
            const actor = iconData.actor;
            if (!actor) return { width: 0, height: 0, scale: 1 };

            // Determine base center relative to SCREEN
            // We use the transformed position for the center, but strictly speaking
            // for a stable fisheye we should look at the "undistorted" center.
            // However, using the actor's current center creates the "chasing" effect interaction.
            // macOS actually maps mouse position to the *undistorted* axis.
            // For now, let's use the actor's current center to determine distance.

            const [iconX, iconY] = actor.get_transformed_position();
            const cx = iconX + actor.width / 2;
            const cy = iconY + actor.height / 2;

            let dist;
            if (isHorizontal) dist = Math.abs(mouseX - cx);
            else dist = Math.abs(mouseY - cy);

            // Calculate Scale
            let w = 0;
            if (dist < r) {
                const t = dist / r;
                // Sine bell curve gives a smoother "hump" than bicubic for this
                w = Math.cos(t * Math.PI / 2);
                w = Math.pow(w, 1.1); // Tune sharpness
            }

            const targetScale = 1 + (this._maxScale - 1) * w;

            // Smooth scale
            iconData.currentScale = lerp(iconData.currentScale, targetScale, 0.25);

            // Calculate physical occupied size
            // For horizontal dock, we care about width. Vertical -> height.
            const baseSize = isHorizontal ? actor.width : actor.height;
            const occupiedSize = baseSize * iconData.currentScale;

            totalSize += occupiedSize;

            return {
                occupiedSize: occupiedSize,
                scale: iconData.currentScale
            };
        });

        // Add spacing to total size
        totalSize += Math.max(0, this._icons.length - 1) * spacing;

        // 2. Resize Container & Center It
        const g = this._baseGeometry;

        // We expand the container to exactly fit the content + padding
        // Warning: This assumes the container has symmetric padding defined in CSS
        // If padding is 6px, we need to account for it? 
        // DockContainer sets 6px padding.
        // Actually, Clutter actors include padding in their width/height if using box layout?
        // St.BoxLayout width/height includes padding.
        // Let's assume the "extra" expansion is (totalSize - originalContentSize).
        // A safer way is:

        const originalContentSize = isHorizontal ? g.w : g.h;
        // Note: g.w includes padding. 
        // But we don't know exact padding here easily.
        // Let's simply calculate the delta from "all icons at scale 1".

        // better: calculate delta
        let delta = 0;
        layoutData.forEach((d, i) => {
            const actor = this._icons[i].actor;
            const base = isHorizontal ? actor.width : actor.height;
            delta += (d.occupiedSize - base);
        });

        if (isHorizontal) {
            const newWidth = g.w + delta;
            this._container.set_width(newWidth);
            this._container.set_x(g.x - delta / 2); // Center
        } else {
            const newHeight = g.h + delta;
            this._container.set_height(newHeight);
            this._container.set_y(g.y - delta / 2); // Center
        }

        // 3. Position Icons Absolutely
        // We need to calculate the start position (left or top) within the container.
        // BoxLayout aligns children. If we mess with translation, we are moving them *relative* to their slots.
        // St.BoxLayout slots will NOT resize unless we change the actor width/height properties?
        // No, we shouldn't change actor.width/height, that breaks layout.
        // We strictly use set_scale and translation.

        // In a BoxLayout, every child is at a specific x,y provided by the layout manager.
        // We know where the "first" child would be if they were all scale 1.
        // But since we expanded the container, the BoxLayout manager might have moved the slots?
        // Actually, since we set the container size manually, if x_align is CENTER, the slots might drift.

        // STRATEGY: 
        // We ignore the BoxLayout's slot positioning for the visual layer.
        // We calculate where the icon *should* be relative to the container's new 0,0.

        // Start position (including padding). 
        // innerPadding was 6px in dockContainer.js
        // padding is already defined above
        let currentPos = padding;

        layoutData.forEach((d, i) => {
            const iconData = this._icons[i];
            const actor = iconData.actor;
            const scale = d.scale;
            const size = d.occupiedSize; // magnified width/height

            actor.set_pivot_point(0.5, 0.5); // Always center pivot for scaling
            actor.set_scale(scale, scale);

            // The layout manager gave the actor a slot (unscaled).
            // We need to translate it so its visual center matches our calculated position.

            // Expected center of this icon in our new layout:
            const expectedCenter = currentPos + size / 2;

            // Where is the actor's slot currently?
            // Since we are inside a layout, actor.x / actor.y are relative to container.
            // BUT, modifying container width might have triggered a relayout?
            // We are in an animation loop. Relayouts are expensive. 
            // We hope the layout manager doesn't thrash.

            // To be robust: We calculate the shift required to move the actor from its *slot* to *expectedCenter*.
            // Note: actor.get_allocation_box() gives the slot.
            const box = actor.get_allocation_box();
            const slotCenter = isHorizontal
                ? (box.x1 + (box.x2 - box.x1) / 2)
                : (box.y1 + (box.y2 - box.y1) / 2);

            const shift = expectedCenter - slotCenter;

            // Apply Translation
            // Also apply vertical/horizontal centering (baseline align)
            // If scale grows, we want it to grow UP (for bottom dock).
            // Since pivot is 0.5, 0.5, it grows centrally.
            // We need to offset the Y (or X) so it sits on the baseline.

            const baseDim = isHorizontal ? actor.height : actor.width;
            const growth = baseDim * (scale - 1);
            const baselineOffset = growth / 2; // Move up by half the growth to keep bottom fixed?
            // Actually, if pivot is center, it grows up and down.
            // We want bottom to stay fixed (for BOTTOM dock).
            // So we shift Y up by baselineOffset.

            let transX = 0;
            let transY = 0;

            if (isHorizontal) {
                transX = shift;
                if (dockPosition === 'BOTTOM') transY = -baselineOffset;
                else if (dockPosition === 'TOP') transY = baselineOffset;
            } else {
                transY = shift;
                if (dockPosition === 'LEFT') transX = baselineOffset;
                else if (dockPosition === 'RIGHT') transX = -baselineOffset;
            }

            actor.translation_x = transX;
            actor.translation_y = transY;

            // Advance cursor
            currentPos += size + spacing;
        });
    }

    _onLeave() {
        this._icons.forEach(iconData => this._resetIcon(iconData));
        this._resetContainer();
    }

    _resetContainer() {
        if (!this._baseGeometry || !this._container) return;

        // Restore dimensions and position
        // Setting width/height to -1 resets to natural size in some Clutter actors, 
        // but for St.BoxLayout it's safer to rely on previously captured values or just letting layout manager handle it?
        // Let's restore the captured base values to be safe and smooth.

        if (this._baseGeometry) {
            this._container.set_width(this._baseGeometry.w);
            this._container.set_height(this._baseGeometry.h);
            this._container.set_x(this._baseGeometry.x);
            this._container.set_y(this._baseGeometry.y);

            // Allow layout manager to take over again cleanly
            // (Setting precise values might override layout manager logic until next allocation)
            // But since we are "leaving", the idle layout update in DockContainer might settle it.
        }

        this._baseGeometry = null;
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

        if (isDragging) {
            this._icons.forEach(iconData => this._resetIcon(iconData));
            this._resetContainer();
        }
    }

    reset() {
        // Public method to force reset geometry (e.g. on icon add/remove)
        this._baseGeometry = null;
    }

    disable() {
        if (this._motionEventId && this._container)
            this._container.disconnect(this._motionEventId);

        if (this._leaveEventId && this._container)
            this._container.disconnect(this._leaveEventId);

        if (this._enterEventId && this._container)
            this._container.disconnect(this._enterEventId);

        this._icons.forEach(iconData => this._resetIcon(iconData));
        this._icons = [];
    }
}
