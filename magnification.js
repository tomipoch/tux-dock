import Clutter from "gi://Clutter";

/**
 * Maneja el efecto de ampliación estilo macOS
 * Los iconos se agrandan progresivamente y el dock se deforma cuando el cursor está cerca
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
    this._isDragging = false; // Track if user is dragging an icon
        
    // Configuración de ampliación
    this._maxScale = this._settings.getMagnificationScale();
    this._influenceRadius = 150; // Radio de influencia en píxeles
    this._curveSteepness = 2.0; // Intensidad de la curva de caída
    this._enableDeformation = true; // Habilitar deformación del contenedor

    // Cache de posiciones para optimización
    this._iconPositions = new Map();
    this._containerOriginalPadding = null;
  }

  enable() {
    if (!this._container) return;

    // Actualizar escala desde settings al habilitar
    this._maxScale = this._settings.getMagnificationScale();

    // Conectar eventos de movimiento del mouse
    this._motionEventId = this._container.connect(
      "motion-event",
      (actor, event) => {
        this._onMotion(event);
        return Clutter.EVENT_PROPAGATE;
      }
    );

    this._leaveEventId = this._container.connect("leave-event", () => {
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
      currentTranslationX: 0,
      currentTranslationY: 0,
    };

    // Buscar el St.Icon dentro de la jerarquía del actor
    const findStIcon = (actor) => {
      if (!actor) return null;

      if (actor.constructor.name === "StIcon") {
        return actor;
      }

      if (actor.child) {
        const found = findStIcon(actor.child);
        if (found) return found;
      }

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
    this._icons.forEach((iconData) => {
      if (iconData.actor) {
        this._resetIcon(iconData);
      }
    });
    this._icons = [];
    this._iconPositions.clear();
  }

  _onMotion(event) {
    if (this._icons.length === 0) return;

    // Skip magnification if currently dragging
    if (this._isDragging) {
        return;
    }

    // Throttling para optimización de rendimiento (60fps)
    const now = Date.now();
    if (now - this._lastUpdateTime < this._updateThrottle) {
      return;
    }
    this._lastUpdateTime = now;

    const [mouseX, mouseY] = event.get_coords();

    // Obtener posición del dock para determinar dirección de magnificación
    const dockPosition = this._settings.getPosition();

    // Actualizar cache de posiciones de iconos
    this._updateIconPositions();

    // Calcular escalas y traducciones para todos los iconos
    const iconScales = this._calculateIconScales(mouseX, mouseY);

    // Aplicar transformaciones
    iconScales.forEach((scaleData, index) => {
      const iconData = this._icons[index];
      if (!iconData || !iconData.actor) return;

      this._applyTransformation(iconData, scaleData, dockPosition);
    });

    // Aplicar deformación del contenedor
    if (this._enableDeformation) {
      this._applyContainerDeformation(iconScales);
    }
  }

  _updateIconPositions() {
    this._iconPositions.clear();

    this._icons.forEach((iconData, index) => {
      if (!iconData.actor) return;

      const [x, y] = iconData.actor.get_transformed_position();
      const width = iconData.actor.width;
      const height = iconData.actor.height;

      this._iconPositions.set(index, {
        x: x,
        y: y,
        centerX: x + width / 2,
        centerY: y + height / 2,
        width: width,
        height: height,
      });
    });
  }

  _calculateIconScales(mouseX, mouseY) {
    const scales = [];
    const dockPosition = this._settings.getPosition();
    const isHorizontal = dockPosition === "BOTTOM";

    // Primera pasada: calcular escalas base
    this._icons.forEach((iconData, index) => {
      const pos = this._iconPositions.get(index);
      if (!pos) {
        scales.push({ scale: 1.0, translationX: 0, translationY: 0 });
        return;
      }

      // Calcular distancia del cursor al centro del icono
      const dx = mouseX - pos.centerX;
      const dy = mouseY - pos.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calcular escala usando curva Gaussiana para transición más suave
      let scale = 1.0;

      if (distance < this._influenceRadius) {
        // Curva Gaussiana: e^(-(distance^2) / (2 * sigma^2))
        const sigma = this._influenceRadius / this._curveSteepness;
        const normalizedDist = distance / sigma;
        const influence = Math.exp(-(normalizedDist * normalizedDist) / 2);
        scale = 1.0 + (this._maxScale - 1.0) * influence;
      }

      scales.push({ scale, translationX: 0, translationY: 0, distance });
    });

    // Segunda pasada: calcular traducciones para crear efecto de "spreading"
    scales.forEach((scaleData, index) => {
      if (scaleData.scale <= 1.0) return;

      const pos = this._iconPositions.get(index);
      if (!pos) return;

      // Calcular desplazamiento basado en la escala
      const scaleDiff = scaleData.scale - 1.0;

      if (isHorizontal) {
        // Para dock horizontal, desplazar verticalmente hacia arriba
        scaleData.translationY = -scaleDiff * 15; // Desplazamiento hacia arriba

        // Desplazamiento horizontal para crear efecto de spreading
        let leftInfluence = 0;
        let rightInfluence = 0;

        // Calcular influencia de iconos vecinos
        for (let i = 0; i < index; i++) {
          if (scales[i].scale > 1.0) {
            leftInfluence += (scales[i].scale - 1.0) * 0.5;
          }
        }

        for (let i = index + 1; i < scales.length; i++) {
          if (scales[i].scale > 1.0) {
            rightInfluence += (scales[i].scale - 1.0) * 0.5;
          }
        }

        scaleData.translationX = (rightInfluence - leftInfluence) * 8;
      } else {
        // Para dock vertical, desplazar horizontalmente hacia el centro
        const isLeft = dockPosition === "LEFT";
        scaleData.translationX = isLeft ? scaleDiff * 15 : -scaleDiff * 15;

        // Desplazamiento vertical para spreading
        let topInfluence = 0;
        let bottomInfluence = 0;

        for (let i = 0; i < index; i++) {
          if (scales[i].scale > 1.0) {
            topInfluence += (scales[i].scale - 1.0) * 0.5;
          }
        }

        for (let i = index + 1; i < scales.length; i++) {
          if (scales[i].scale > 1.0) {
            bottomInfluence += (scales[i].scale - 1.0) * 0.5;
          }
        }

        scaleData.translationY = (bottomInfluence - topInfluence) * 8;
      }
    });

    return scales;
  }

  _applyTransformation(iconData, scaleData, dockPosition) {
    const actor = iconData.actor;
    if (!actor) return;

    // Remover cualquier animación previa
    actor.remove_all_transitions();

    // Ajustar pivot point según posición del dock
    if (dockPosition === "BOTTOM") {
      actor.set_pivot_point(0.5, 1.0); // Escalar desde abajo-centro
    } else if (dockPosition === "LEFT") {
      actor.set_pivot_point(0.0, 0.5); // Escalar desde izquierda-centro
    } else if (dockPosition === "RIGHT") {
      actor.set_pivot_point(1.0, 0.5); // Escalar desde derecha-centro
    }

    // Aplicar escala y traslación directamente (sin animación para fluidez)
    const scaleDiff = Math.abs(scaleData.scale - iconData.currentScale);
    const translationXDiff = Math.abs(
      scaleData.translationX - iconData.currentTranslationX
    );
    const translationYDiff = Math.abs(
      scaleData.translationY - iconData.currentTranslationY
    );

    // Solo actualizar si hay cambio significativo (evita parpadeos)
    if (scaleDiff > 0.01 || translationXDiff > 0.5 || translationYDiff > 0.5) {
      actor.set_scale(scaleData.scale, scaleData.scale);
      actor.translation_x = scaleData.translationX;
      actor.translation_y = scaleData.translationY;

      iconData.currentScale = scaleData.scale;
      iconData.currentTranslationX = scaleData.translationX;
      iconData.currentTranslationY = scaleData.translationY;
    }
  }

  _applyContainerDeformation(iconScales) {
    if (!this._container) return;

    // Calcular el máximo nivel de magnificación actual
    const maxCurrentScale = Math.max(...iconScales.map((s) => s.scale));

    if (maxCurrentScale > 1.1) {
      // Hay magnificación significativa, ajustar padding del contenedor
      const extraPadding = Math.floor((maxCurrentScale - 1.0) * 20);

      // Guardar padding original si no existe
      if (this._containerOriginalPadding === null) {
        this._containerOriginalPadding = 10; // Valor por defecto
      }

      const dockPosition = this._settings.getPosition();
      const opacity = this._settings.getDockOpacity();
      const margin = this._settings.getDockMargin();

      // Aplicar padding adicional según la posición
      if (dockPosition === "BOTTOM") {
        this._container.set_style(`
                    background-color: rgba(40, 40, 40, ${opacity});
                    border-radius: 18px;
                    padding: ${
                      this._containerOriginalPadding + extraPadding
                    }px 14px ${this._containerOriginalPadding}px 14px;
                    margin-bottom: ${margin}px;
                `);
      } else {
        // Para posiciones laterales
        this._container.set_style(`
                    background-color: rgba(40, 40, 40, ${opacity});
                    border-radius: 18px;
                    padding: 14px ${
                      this._containerOriginalPadding + extraPadding
                    }px 14px ${this._containerOriginalPadding}px;
                    margin-bottom: ${margin}px;
                `);
      }
    } else {
      // Restaurar padding original
      this._restoreContainerStyle();
    }
  }

  _restoreContainerStyle() {
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

  _onLeave() {
    // Resetear todos los iconos cuando el cursor sale del dock
    this._icons.forEach((iconData) => {
      if (iconData.actor) {
        this._resetIcon(iconData);
      }
    });

    // Restaurar estilo del contenedor
    this._restoreContainerStyle();
  }

  _resetIcon(iconData) {
    const actor = iconData.actor;
    if (!actor) return;

    // Remover transiciones
    actor.remove_all_transitions();

    // Resetear transformaciones
    actor.set_scale(1.0, 1.0);
    actor.translation_x = 0;
    actor.translation_y = 0;

    iconData.currentScale = 1.0;
    iconData.currentTranslationX = 0;
    iconData.currentTranslationY = 0;
  }

  setMaxScale(scale) {
    this._maxScale = Math.max(1.0, Math.min(3.0, scale));
  }

  setInfluenceRadius(radius) {
    this._influenceRadius = Math.max(50, Math.min(300, radius));
  }

  setCurveSteepness(steepness) {
    this._curveSteepness = Math.max(1.0, Math.min(4.0, steepness));
  }

  setEnableDeformation(enabled) {
    this._enableDeformation = enabled;
    if (!enabled) {
      this._restoreContainerStyle();
    }
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
    this._icons.forEach((iconData) => {
      if (iconData.actor) {
        this._resetIcon(iconData);
      }
    });

    // Restaurar contenedor
    this._restoreContainerStyle();

    this._icons = [];
    this._iconPositions.clear();
  }
}
