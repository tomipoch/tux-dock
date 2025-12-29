/**
 * Configuración central de Tux-Dock
 * TODAS las constantes, enums y valores por defecto consolidados
 */

// ============ ENUMS ============

export const DockPosition = Object.freeze({
    BOTTOM: 'BOTTOM',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    TOP: 'TOP',
});

export const ClickAction = Object.freeze({
    FOCUS_OR_LAUNCH: 'focus-or-launch',
    MINIMIZE_OR_FOCUS: 'minimize-or-focus',
    PREVIEWS: 'previews',
});

export const MiddleClickAction = Object.freeze({
    NEW_WINDOW: 'new-window',
    MINIMIZE: 'minimize',
    QUIT: 'quit',
});

export const ScrollAction = Object.freeze({
    CYCLE_WINDOWS: 'cycle-windows',
    NOTHING: 'nothing',
});

export const MinimizeAnimation = Object.freeze({
    SCALE: 'scale',
    GENIE: 'genie',
    NONE: 'none',
});

export const DockDirection = Object.freeze({
    BOTTOM: 0,
    TOP: 1,
    LEFT: 2,
    RIGHT: 3,
});

// ============ TAMAÑOS ============

export const IconSize = Object.freeze({
    DEFAULT: 48,
    MIN: 32,
    MAX: 96,
});

export const Spacing = Object.freeze({
    CONTAINER_PADDING: 6,
    CONTAINER_SPACING: 2,
    ICON_PADDING: 8,
    ICON_MARGIN: 4,
    DOCK_MARGIN: 8,
});

export const BorderRadius = Object.freeze({
    CONTAINER: 18,
    ICON: 12,
    INDICATOR: 2,
    TOOLTIP: 6,
});

// ============ ANIMACIONES (ms) ============

export const AnimationTime = Object.freeze({
    INSTANT: 0,
    FAST: 100,
    NORMAL: 200,
    SLOW: 300,
    ICON_ENTER: 180,
    ICON_EXIT: 180,
    BOUNCE: 130,
    PREVIEW_SHOW: 500,
    PREVIEW_HIDE: 300,
    MINIMIZE: 250,
    MAGIC_LAMP: 350,
});

// ============ AUTOHIDE ============

export const Autohide = Object.freeze({
    DELAY_HIDE: 300,
    DELAY_SHOW: 100,
    EDGE_DISTANCE: 5,
    DRAG_THRESHOLD: 50,
});

// ============ MAGNIFICACIÓN ============

export const Magnification = Object.freeze({
    DEFAULT_SCALE: 2.0,
    MIN_SCALE: 1.0,
    MAX_SCALE: 3.0,
    INFLUENCE_RADIUS: 250,
    FPS: 60,
    LERP_FACTOR: 0.25,
});

// ============ PREVIEW ============

export const Preview = Object.freeze({
    MIN_WIDTH: 220,
    MIN_HEIGHT: 100,
    OFFSET_Y: 15,
    SCREEN_MARGIN: 10,
    MAX_WINDOWS: 4,
    SHOW_DELAY: 500,
    HIDE_DELAY: 300,
    HOVER_DELAY: 1200,
});

// ============ TOOLTIP ============

export const Tooltip = Object.freeze({
    SHOW_DELAY: 500,
    OFFSET_Y: 8,
});

// ============ BOUNCE ============

export const Bounce = Object.freeze({
    DEFAULT_COUNT: 3,
    INTENSITY: 0.35,
    CONTINUOUS_INTENSITY: 0.4,
    BASE_HEIGHT: 28,
    CHECK_INTERVAL: 120,
});

// ============ TRASH ============

export const Trash = Object.freeze({
    POLL_INTERVAL: 5, // segundos
});

// ============ STACK ============

export const Stack = Object.freeze({
    POPUP_COLUMNS: 4,
    ICON_SIZE: 48,
    POPUP_ITEM_SIZE: 64,
    MAX_PREVIEW_ITEMS: 3,
});

// ============ DRAG & DROP ============

export const DragDrop = Object.freeze({
    THRESHOLD: 50,
    ICON_SIZE: 48,
});

// ============ MAGIC LAMP ============

export const MagicLamp = Object.freeze({
    TILES_X: 48,
    TILES_Y: 24,
    MAX_BEND: 0.35,
    TAIL_EXPONENT: 3.2,
    COLLAPSE_FACTOR: 0.85,
});

// ============ OPACIDAD ============

export const Opacity = Object.freeze({
    FULL: 255,
    DIMMED: 200,
    DRAGGING: 100,
    HIDDEN: 0,
    DEFAULT_DOCK: 0.9,
});

// ============ COLORES (referencia para CSS) ============

export const Colors = Object.freeze({
    BG_CONTAINER: 'rgba(40, 40, 40, 0.9)',
    BG_ICON_NORMAL: 'rgba(255, 255, 255, 0.1)',
    BG_ICON_HOVER: 'rgba(255, 255, 255, 0.2)',
    BG_ICON_CHECKED: 'rgba(255, 255, 255, 0.25)',
    INDICATOR_BLUE: 'rgba(52, 152, 219, 0.8)',
    INDICATOR_RED: 'rgba(231, 76, 60, 0.9)',
    BADGE_RED: '#e74c3c',
    TOOLTIP_BG: 'rgba(0, 0, 0, 0.8)',
    PREVIEW_BG: 'rgba(30, 30, 30, 0.95)',
    SEPARATOR: 'rgba(255, 255, 255, 0.3)',
    WHITE: 'white',
});

// ============ CSS CLASES ============

export const CssClass = Object.freeze({
    CONTAINER: 'tux-dock-container',
    APP_BUTTON: 'tux-dock-app-button',
    ICON_CONTAINER: 'tux-dock-icon-container',
    TOOLTIP: 'tux-dock-tooltip',
    BADGE: 'tux-dock-badge',
    SEPARATOR: 'tux-dock-separator',
    CONTEXT_MENU: 'tux-dock-context-menu',
    MENU_HEADER: 'tux-dock-menu-header',
    PREVIEW_CONTAINER: 'tux-dock-preview-container',
    PREVIEW_ITEM: 'tux-dock-preview-item',
    REMOVAL_INDICATOR: 'tux-dock-removal-indicator',
    INSERTION_INDICATOR: 'tux-dock-insertion-indicator',
    SPECIAL: 'tux-dock-special',
    DROP_TARGET: 'drop-target',
});
