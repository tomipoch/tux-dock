# Contributing to Tux-Dock

¡Gracias por tu interés en contribuir a Tux-Dock! Este documento proporciona pautas para contribuir al proyecto.

## Código de Conducta

- Sé respetuoso y constructivo
- Acepta críticas constructivas
- Enfócate en lo mejor para la comunidad

## Cómo Contribuir

### Reportar Bugs

1. Verifica que el bug no haya sido reportado antes
2. Usa el template de issue para bugs
3. Incluye:
   - Versión de GNOME Shell
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Logs relevantes (`journalctl -f /usr/bin/gnome-shell | grep TuxDock`)

### Sugerir Features

1. Abre un issue describiendo la feature
2. Explica el caso de uso
3. Proporciona ejemplos si es posible

### Pull Requests

#### Antes de Empezar

1. Fork el repositorio
2. Crea una branch desde `main`: `git checkout -b feature/mi-feature`
3. Configura el entorno de desarrollo

#### Estándares de Código

**JavaScript/GJS**:
- Usa 2 espacios para indentación
- Nombres de variables en camelCase
- Nombres de clases en PascalCase
- Constantes en UPPER_SNAKE_CASE
- Usa `const` por defecto, `let` cuando sea necesario
- Evita `var`

**Imports**:
```javascript
// GI imports primero
import St from 'gi://St';
import Clutter from 'gi://Clutter';

// GNOME Shell imports
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Imports locales
import { DockSettings } from './settings.js';
```

**Comentarios**:
```javascript
/**
 * Descripción de la función
 * @param {string} param - Descripción del parámetro
 * @returns {boolean} Descripción del retorno
 */
function myFunction(param) {
  // Implementación
}
```

#### Commits

- Usa mensajes descriptivos en español
- Formato: `tipo: descripción breve`
- Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`

Ejemplos:
```
feat: agregar soporte para autohide en posición TOP
fix: corregir memory leak en event listeners
docs: actualizar README con instrucciones de instalación
```

#### Testing

Antes de hacer PR:

1. **Prueba manual**:
   ```bash
   gnome-extensions disable tux-dock@tomipoch.github.com
   gnome-extensions enable tux-dock@tomipoch.github.com
   ```

2. **Verifica logs**:
   ```bash
   journalctl -f /usr/bin/gnome-shell | grep -i "error\|tuxdock"
   ```

3. **Prueba en diferentes posiciones**: BOTTOM, TOP, LEFT, RIGHT

4. **Verifica memory leaks**:
   - Habilita/deshabilita la extensión 10 veces
   - Monitorea uso de memoria de gnome-shell

#### Checklist de PR

- [ ] El código sigue los estándares del proyecto
- [ ] Los commits tienen mensajes descriptivos
- [ ] Se han probado los cambios manualmente
- [ ] No hay errores en los logs
- [ ] Se actualizó la documentación si es necesario
- [ ] Se incrementó la versión en `metadata.json` (semver)

## Estructura del Proyecto

```
tux-dock@tomipoch.github.com/
├── extension.js          # Punto de entrada
├── prefs.js             # Preferencias
├── settings.js          # Gestión de configuración
├── constants.js         # Constantes globales
├── utils.js             # Utilidades
├── dockContainer.js     # Contenedor principal
├── appManager.js        # Gestión de aplicaciones
├── appIcon.js           # Iconos de aplicaciones
├── specialIcons.js      # Iconos especiales (launcher, trash)
├── contextMenu.js       # Menú contextual
├── autohide.js          # Ocultamiento automático
├── magnification.js     # Efecto de magnificación
├── dragAndDrop.js       # Drag and drop
├── windowPreview.js     # Preview de ventanas
├── minimizeToIcon.js    # Minimizar al icono
└── schemas/             # GSettings schemas
```

## Versionado Semántico

Seguimos [SemVer](https://semver.org/):

- **MAJOR**: Cambios incompatibles en la API
- **MINOR**: Nueva funcionalidad compatible
- **PATCH**: Bug fixes compatibles

Ejemplo: `2.1.3`
- 2 = versión mayor
- 1 = versión menor
- 3 = parche

## Recursos

- [GNOME Shell Extensions](https://gjs.guide/extensions/)
- [GJS Documentation](https://gjs-docs.gnome.org/)
- [GNOME Shell Source](https://gitlab.gnome.org/GNOME/gnome-shell)

## Preguntas

Si tienes preguntas, abre un issue con la etiqueta `question`.

¡Gracias por contribuir! 🎉
