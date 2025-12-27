# Registro de cambios - Configuraciones en vivo

## Fecha: 27 de diciembre de 2025

### ✅ Problemas corregidos

1. **Botón "Mostrar aplicaciones" arreglado**
   - Ahora abre el cajón de aplicaciones (`App Grid`) directamente
   - Ya no redirige al overview/activities
   - Ubicación: `specialIcons.js`

2. **Sistema de configuración en tiempo real implementado**
   - Se añadieron listeners para TODAS las configuraciones
   - Los cambios ahora se aplican inmediatamente sin necesidad de reiniciar

### 📦 Nuevas configuraciones añadidas

#### En `gschema.xml`:
- `dock-opacity` (0.0-1.0): Transparencia del fondo del dock
- `intellihide` (bool): Ocultamiento inteligente cuando ventanas se superponen
- `push-windows` (bool): Empujar ventanas en lugar de superponerse
- `minimize-to-dock` (bool): Minimizar ventanas a sus iconos
- `show-trash` (bool): Mostrar icono de papelera
- `show-app-launcher` (bool): Mostrar lanzador de aplicaciones
- `enable-bounce` (bool): Animación de rebote para notificaciones
- `click-action` (string): Acción al hacer clic (enfocar/lanzar, minimizar/enfocar, previsualizaciones)
- `middle-click-action` (string): Acción del clic medio (nueva ventana, minimizar, cerrar)
- `scroll-action` (string): Acción de la rueda del ratón (cambiar ventanas, nada)
- `dock-margin` (int 0-50): Margen desde el borde de la pantalla
- `animation-duration` (int 0-1000): Duración de las animaciones en ms

#### En `prefs.js`:
Se añadieron 4 grupos de configuración:

1. **Apariencia**
   - Tamaño de iconos
   - Magnificación (activar/desactivar + intensidad)
   - Posición del dock (Abajo/Izquierda/Derecha)
   - Opacidad del fondo
   - Margen del dock

2. **Comportamiento**
   - Ocultamiento automático
   - Ocultamiento inteligente
   - Empujar ventanas
   - Minimizar al dock
   - Acción de clic izquierdo
   - Acción de clic medio
   - Acción de scroll/rueda

3. **Iconos Especiales**
   - Mostrar papelera
   - Mostrar lanzador de apps

4. **Animaciones**
   - Animación de rebote
   - Duración de animaciones

### 🔧 Mejoras técnicas implementadas

#### `settings.js`:
- Añadidos métodos getter/setter para TODAS las nuevas configuraciones
- Actualizado fallback con valores por defecto
- Total: ~180 líneas de métodos nuevos

#### `extension.js`:
- Implementados 11 listeners de configuración en `_connectSettings()`:
  - `changed::autohide`
  - `changed::intellihide`
  - `changed::magnification-enabled`
  - `changed::magnification-scale`
  - `changed::icon-size`
  - `changed::position`
  - `changed::dock-opacity`
  - `changed::dock-margin`
  - `changed::minimize-to-dock`
  - `changed::show-trash`
  - `changed::show-app-launcher`
  - `changed::show-running-indicator`
  - `changed::show-window-count`

#### `dockContainer.js`:
- Añadido método `_updateStyle()` para actualizar opacidad y margen dinámicamente
- Actualizado `updatePosition()` para usar el margen configurado
- Añadido método público `updateStyle()` para llamadas externas

#### `appManager.js`:
- Actualizado `refresh()` para respetar las configuraciones de iconos especiales
- Los iconos de papelera y lanzador de apps se muestran/ocultan según configuración

#### `autohide.js`:
- Añadido método `setIntellihide(enabled)` para soporte futuro de intellihide

#### `minimizeToIcon.js`:
- Añadida verificación de configuración `minimize-to-dock`
- Solo se activa si está habilitado en configuración

### 🧪 Cómo probar

1. **Recargar la extensión:**
   ```bash
   # En X11:
   Alt+F2 → escribir 'r' → Enter
   
   # En Wayland:
   Cerrar sesión y volver a iniciar
   ```

2. **Abrir configuración:**
   ```bash
   gnome-extensions prefs tux-dock@tomipoch.github.com
   ```

3. **Probar cambios en vivo:**
   - Cambia la opacidad → debe aplicarse inmediatamente
   - Cambia la posición → el dock debe moverse
   - Cambia el tamaño de iconos → debe reconstruirse
   - Activa/desactiva magnificación → debe activarse/desactivarse
   - Activa/desactiva iconos especiales → deben aparecer/desaparecer
   - Cambia el margen → debe moverse desde el borde

### ⚠️ Notas importantes

1. **Primer inicio:** Algunos cambios pueden tardar un momento en aplicarse la primera vez
2. **Iconos especiales:** Requieren reconstrucción del dock (tarda ~100ms)
3. **Opacidad y márgenes:** Se aplican instantáneamente
4. **Posición:** Se recalcula y aplica inmediatamente

### 📋 Pendiente por implementar

- Lógica completa de intellihide (detectar ventanas superpuestas específicamente)
- Push windows (empujar ventanas del área del dock)
- Acciones de clic medio y scroll en los iconos de aplicaciones
- Animación de rebote para notificaciones
- Stacks de carpetas

### 🐛 Depuración

Si algo no funciona:

1. Ver logs en tiempo real:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell
   ```

2. Verificar que el esquema está compilado:
   ```bash
   ls -la ~/.local/share/gnome-shell/extensions/tux-dock@tomipoch.github.com/schemas/gschemas.compiled
   ```

3. Ver valores actuales:
   ```bash
   gsettings --schemadir ~/.local/share/gnome-shell/extensions/tux-dock@tomipoch.github.com/schemas list-recursively org.gnome.shell.extensions.tux-dock
   ```
