# Tux-Dock Architecture

## Visión General

Tux-Dock sigue una arquitectura modular basada en componentes, donde cada módulo tiene una responsabilidad específica.

## Principios de Diseño

### 1. Separación de Responsabilidades
Cada módulo maneja un aspecto específico:
- **extension.js**: Orquestación y ciclo de vida
- **dockContainer.js**: UI y posicionamiento
- **appManager.js**: Lógica de aplicaciones
- **settings.js**: Configuración

### 2. Event-Driven Architecture
Los componentes se comunican mediante eventos de GObject:
```javascript
this._settings.connect('changed::position', () => {
  this._dockContainer.updatePosition();
});
```

### 3. Dependency Injection
Los componentes reciben sus dependencias en el constructor:
```javascript
constructor(dockContainer, settings) {
  this._dockContainer = dockContainer;
  this._settings = settings;
}
```

## Estructura de Componentes

### Core Components

```
Extension (extension.js)
    ├── DockSettings (settings.js)
    ├── DockContainer (dockContainer.js)
    │   ├── Magnification (magnification.js)
    │   └── DockAnimations (animations.js)
    ├── AppManager (appManager.js)
    │   ├── AppIcon (appIcon.js)
    │   ├── SpecialIcons (specialIcons.js)
    │   └── DragDropHandler (dragAndDrop.js)
    ├── AutohideManager (autohide.js)
    └── MinimizeToIcon (minimizeToIcon.js)
```

### Component Responsibilities

#### Extension
- Inicialización y cleanup
- Coordinación de componentes
- Manejo de ciclo de vida

#### DockContainer
- Renderizado del contenedor
- Posicionamiento y orientación
- Gestión de chrome

#### AppManager
- Gestión de iconos de apps
- Sincronización con favoritos
- Refresh y rebuild

#### Settings
- Interfaz con GSettings
- Notificaciones de cambios
- Valores por defecto

## Data Flow

```
User Action
    ↓
Event Handler (appIcon.js, contextMenu.js)
    ↓
Business Logic (appManager.js, autohide.js)
    ↓
State Update (settings.js, internal state)
    ↓
UI Update (dockContainer.js, appIcon.js)
    ↓
Render (Clutter/St)
```

## Performance Optimizations

### 1. Debouncing
Eventos frecuentes (mouse move) usan debouncing:
```javascript
import { debounce } from './performance.js';

this._onMouseMove = debounce((x, y) => {
  this._checkMousePosition(x, y);
}, 50);
```

### 2. Batch Updates
Múltiples cambios se agrupan:
```javascript
const batchUpdater = new BatchUpdater();
batchUpdater.schedule('position', () => this.updatePosition());
batchUpdater.schedule('style', () => this.updateStyle());
```

### 3. Lazy Loading
Componentes pesados se cargan bajo demanda:
```javascript
_getWindowPreview() {
  if (!this._preview) {
    this._preview = new WindowPreview();
  }
  return this._preview;
}
```

### 4. Minimize Redraws
- Usar `queue_relayout()` en lugar de múltiples cambios
- Agrupar cambios de estilo
- Evitar `remove_all_transitions()` innecesario

## Memory Management

### Signal Tracking
```javascript
constructor() {
  this._signalIds = [];
}

connect() {
  this._signalIds.push(
    actor.connect('event', handler)
  );
}

destroy() {
  this._signalIds.forEach(id => actor.disconnect(id));
  this._signalIds = [];
}
```

### Timeout Cleanup
```javascript
destroy() {
  if (this._timeoutId) {
    GLib.source_remove(this._timeoutId);
    this._timeoutId = null;
  }
}
```

## Error Handling

### Consistent Logging
```javascript
import { logError } from './utils.js';

try {
  // código
} catch (e) {
  logError('Descripción del error', e);
}
```

### Graceful Degradation
```javascript
try {
  this._trashMonitor = file.monitor(...);
} catch (e) {
  logError('Monitor failed, using polling', e);
  this._setupPolling();
}
```

## Testing Strategy

### Manual Testing
1. Habilitar/deshabilitar extensión
2. Probar en todas las posiciones
3. Verificar memory leaks
4. Revisar logs

### Future: Automated Testing
```javascript
// Ejemplo de test unitario
describe('AppManager', () => {
  it('should add favorite apps', () => {
    const manager = new AppManager(...);
    manager.addFavorite('org.gnome.Terminal.desktop');
    expect(manager.getFavorites()).toContain('org.gnome.Terminal.desktop');
  });
});
```

## Extensibility

### Adding New Features

1. **Crear nuevo módulo**:
```javascript
// myFeature.js
export class MyFeature {
  constructor(dockContainer, settings) {
    this._dockContainer = dockContainer;
    this._settings = settings;
  }

  enable() { /* ... */ }
  disable() { /* ... */ }
  destroy() { /* ... */ }
}
```

2. **Integrar en extension.js**:
```javascript
import { MyFeature } from './myFeature.js';

enable() {
  this._myFeature = new MyFeature(this._dockContainer, this._settings);
  this._myFeature.enable();
}
```

3. **Agregar configuración**:
```xml
<!-- schemas/org.gnome.shell.extensions.tux-dock.gschema.xml -->
<key name="my-feature-enabled" type="b">
  <default>true</default>
</key>
```

## Best Practices

1. **Siempre limpiar recursos** en `destroy()`
2. **Usar GLib.timeout_add** en lugar de setTimeout
3. **Validar inputs** antes de usar
4. **Documentar APIs públicas** con JSDoc
5. **Seguir convenciones** de nomenclatura
6. **Evitar magic numbers** - usar constantes
7. **Manejar errores** gracefully
8. **Testear en todas las posiciones** del dock

## Future Improvements

- [ ] Event bus para comunicación desacoplada
- [ ] State management centralizado
- [ ] Plugin system para extensibilidad
- [ ] Automated testing framework
- [ ] Performance profiling tools
