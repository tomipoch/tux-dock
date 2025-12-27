# 🐧 Tux Dock

<div align="center">

**Un dock elegante y funcional para GNOME Shell inspirado en macOS**

[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-49-blue.svg)](https://www.gnome.org/)
[![License](https://img.shields.io/badge/License-GPL%20v3-green.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-GJS-yellow.svg)](https://gitlab.gnome.org/GNOME/gjs)

</div>

---

## 📋 Descripción

**Tux Dock** es una extensión para GNOME Shell que transforma la barra de aplicaciones tradicional en un dock moderno y personalizable. Inspirado en el diseño de macOS, ofrece una experiencia visual elegante con funcionalidades avanzadas como magnificación, ocultamiento inteligente, y animaciones fluidas.

Esta extensión mueve la barra fuera de la vista general (overview), transformándola en un dock independiente que facilita el lanzamiento de aplicaciones y acelera el cambio entre ventanas y escritorios.

## ✨ Características principales

### 🎨 Apariencia
- **Magnificación por proximidad**: Los iconos se agrandan al pasar el cursor sobre ellos
- **Posicionamiento flexible**: Coloca el dock en la parte inferior, izquierda o derecha de la pantalla
- **Transparencia configurable**: Ajusta la opacidad del fondo del dock (0-100%)
- **Tamaño de iconos personalizable**: Adapta el tamaño de los iconos a tus preferencias
- **Márgenes ajustables**: Controla la distancia del dock desde el borde de la pantalla

### 🚀 Funcionalidad
- **Aplicaciones fijadas y en ejecución**: Muestra tanto apps favoritas como aplicaciones abiertas
- **Arrastrar y soltar**: Reordena iconos fácilmente arrastrándolos
- **Minimizar al dock**: Las ventanas minimizadas se ocultan en sus iconos respectivos
- **Ocultamiento automático**: El dock se oculta cuando no está en uso
- **Ocultamiento inteligente**: Se oculta solo cuando las ventanas se superponen
- **Indicadores de estado**: Muestra qué aplicaciones están abiertas y cuántas ventanas tienen

### 🎯 Iconos especiales
- **Lanzador de aplicaciones**: Acceso rápido al cajón de aplicaciones (App Grid)
- **Papelera**: Icono de papelera integrado en el dock
- **Separador visual**: Divide aplicaciones fijadas de las aplicaciones en ejecución

### ⚡ Interacciones
- **Clic izquierdo**: Abre o enfoca la aplicación
- **Clic medio**: Configurable (nueva ventana, minimizar, cerrar)
- **Rueda del ratón**: Configurable (cambiar entre ventanas, ninguna acción)
- **Vista previa de ventanas**: Previsualización al pasar el cursor sobre iconos con múltiples ventanas

### 🎬 Animaciones
- **Animaciones suaves**: Transiciones fluidas y profesionales
- **Duración configurable**: Ajusta la velocidad de las animaciones (0-1000ms)
- **Rebote para notificaciones**: Animación de rebote cuando una app requiere atención (próximamente)

## 🔧 Instalación

### Requisitos
- GNOME Shell 49 o superior
- Sistema operativo Linux con GNOME (Fedora, Ubuntu, etc.)
- Soporte para Wayland o X11

### Método 1: Instalación manual

1. **Clona el repositorio**:
   ```bash
   git clone https://github.com/tomipoch/tux-dock.git
   cd tux-dock
   ```

2. **Copia los archivos a la carpeta de extensiones**:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/tux-dock@tomipoch.github.com
   cp -r * ~/.local/share/gnome-shell/extensions/tux-dock@tomipoch.github.com/
   ```

3. **Compila el esquema de configuración**:
   ```bash
   cd ~/.local/share/gnome-shell/extensions/tux-dock@tomipoch.github.com/schemas
   glib-compile-schemas .
   ```

4. **Reinicia GNOME Shell**:
   - En **X11**: Presiona `Alt+F2`, escribe `r` y presiona Enter
   - En **Wayland**: Cierra sesión y vuelve a iniciar

5. **Habilita la extensión**:
   ```bash
   gnome-extensions enable tux-dock@tomipoch.github.com
   ```

### Método 2: Instalación desde GNOME Extensions (próximamente)

La extensión estará disponible en [extensions.gnome.org](https://extensions.gnome.org/) próximamente.

## ⚙️ Configuración

Abre el panel de preferencias de la extensión:

```bash
gnome-extensions prefs tux-dock@tomipoch.github.com
```

### Opciones disponibles

#### 🎨 Apariencia
| Opción | Descripción | Valores |
|--------|-------------|---------|
| Tamaño de iconos | Tamaño base de los iconos | 32-96 px |
| Magnificación | Activar/desactivar efecto de zoom | On/Off |
| Intensidad de magnificación | Nivel de zoom al pasar el cursor | 1.0-2.5x |
| Posición del dock | Ubicación en la pantalla | Abajo/Izquierda/Derecha |
| Opacidad del fondo | Transparencia del dock | 0-100% |
| Margen del dock | Distancia desde el borde | 0-50 px |

#### 🔄 Comportamiento
| Opción | Descripción | Valores |
|--------|-------------|---------|
| Ocultamiento automático | Ocultar cuando no está en uso | On/Off |
| Ocultamiento inteligente | Ocultar solo cuando ventanas se superponen | On/Off |
| Empujar ventanas | Reservar espacio para el dock | On/Off |
| Minimizar al dock | Minimizar ventanas a sus iconos | On/Off |
| Acción de clic izquierdo | Comportamiento del clic principal | Enfocar/Lanzar, Minimizar/Enfocar, Previsualizaciones |
| Acción de clic medio | Comportamiento del clic medio | Nueva ventana, Minimizar, Cerrar |
| Acción de scroll | Comportamiento de la rueda del ratón | Cambiar ventanas, Ninguna |

#### 🎯 Iconos especiales
| Opción | Descripción | Valores |
|--------|-------------|---------|
| Mostrar papelera | Mostrar icono de papelera | On/Off |
| Mostrar lanzador de apps | Mostrar botón de aplicaciones | On/Off |
| Mostrar separador | Separador entre apps fijadas y abiertas | On/Off |

#### 🎬 Animaciones
| Opción | Descripción | Valores |
|--------|-------------|---------|
| Animación de rebote | Rebote para notificaciones | On/Off |
| Duración de animaciones | Velocidad de las animaciones | 0-1000 ms |

### Configuración en tiempo real

Todos los cambios de configuración se aplican **inmediatamente** sin necesidad de reiniciar GNOME Shell. Simplemente ajusta las opciones en el panel de preferencias y observa los cambios en vivo.

## 🛠️ Arquitectura técnica

### Estructura de archivos

```
tux-dock/
├── extension.js           # Punto de entrada principal
├── dockContainer.js       # Contenedor visual del dock
├── appManager.js          # Gestión de aplicaciones e iconos
├── appIcon.js             # Clase para iconos de aplicaciones
├── specialIcons.js        # Iconos especiales (papelera, lanzador)
├── stackIcon.js           # Iconos de carpetas/stacks
├── settings.js            # Gestión de configuración
├── autohide.js            # Lógica de ocultamiento
├── magnification.js       # Efecto de magnificación
├── animations.js          # Sistema de animaciones
├── minimizeToIcon.js      # Minimización a iconos
├── dragAndDrop.js         # Arrastrar y soltar
├── contextMenu.js         # Menús contextuales
├── windowPreview.js       # Vistas previas de ventanas
├── utils.js               # Utilidades generales
├── prefs.js               # Interfaz de preferencias
├── metadata.json          # Metadatos de la extensión
└── schemas/               # Esquemas de configuración
    └── org.gnome.shell.extensions.tux-dock.gschema.xml
```

### Componentes principales

- **TuxDock**: Clase principal que coordina todos los componentes
- **DockContainer**: Maneja el contenedor visual y posicionamiento
- **AppManager**: Gestiona la lista de aplicaciones y sus iconos
- **AutohideManager**: Controla el comportamiento de ocultamiento
- **MinimizeToIcon**: Implementa la minimización a iconos del dock
- **DockSettings**: Interfaz para acceder a la configuración

## 🐛 Depuración

### Ver logs en tiempo real

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

### Verificar esquema compilado

```bash
ls -la ~/.local/share/gnome-shell/extensions/tux-dock@tomipoch.github.com/schemas/gschemas.compiled
```

### Ver valores de configuración actuales

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/tux-dock@tomipoch.github.com/schemas \
  list-recursively org.gnome.shell.extensions.tux-dock
```

### Reiniciar la extensión

```bash
# Deshabilitar
gnome-extensions disable tux-dock@tomipoch.github.com

# Habilitar
gnome-extensions enable tux-dock@tomipoch.github.com
```

## 📝 Registro de cambios

Consulta [CHANGELOG_CONFIGURACIONES.md](CHANGELOG_CONFIGURACIONES.md) para ver el historial detallado de cambios y mejoras.

## 🗺️ Roadmap

### ✅ Fase 1 - MVP funcional (Completado)
- [x] Dock básico visible
- [x] Iconos de apps abiertas y fijadas
- [x] Click para abrir/enfocar
- [x] Ocultamiento automático

### ✅ Fase 2 - Calidad dock (Completado)
- [x] Fijar/desfijar aplicaciones
- [x] Arrastrar y soltar
- [x] Indicadores de estado
- [x] Panel de configuración completo
- [x] Configuración en tiempo real

### ✅ Fase 3 - Estilo macOS (Completado)
- [x] Magnificación por proximidad
- [x] Animaciones pulidas
- [x] Transparencia configurable
- [x] Minimizar al dock

### 🚧 Fase 4 - Extras (En desarrollo)
- [ ] Animación de rebote para notificaciones
- [ ] Stacks de carpetas (grid/lista)
- [ ] Widgets multimedia (MPRIS)
- [ ] Badges avanzados con contadores
- [ ] Intellihide completo (detección de superposición)
- [ ] Push windows (empujar ventanas)
- [ ] Soporte multi-monitor mejorado

## 🤝 Contribuir

Las contribuciones son bienvenidas. Si deseas contribuir:

1. Haz un fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Realiza tus cambios y haz commit (`git commit -am 'Añade nueva funcionalidad'`)
4. Sube los cambios a tu fork (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

### Guías de desarrollo

- Sigue las convenciones de código existentes
- Documenta las funciones y clases nuevas
- Prueba tus cambios en GNOME Shell antes de enviar un PR
- Actualiza la documentación si es necesario

## 📄 Licencia

Este proyecto está licenciado bajo la GNU General Public License v3.0. Consulta el archivo [LICENSE](LICENSE) para más detalles.

## 👤 Autor

**Tomás Ipoch**
- GitHub: [@tomipoch](https://github.com/tomipoch)

## 🙏 Agradecimientos

- Inspirado en el dock de macOS
- Basado en las APIs de GNOME Shell
- Gracias a la comunidad de GNOME por las herramientas y documentación

## 📚 Recursos adicionales

- [Documentación de GNOME Shell Extensions](https://gjs.guide/extensions/)
- [GJS Documentation](https://gjs-docs.gnome.org/)
- [GNOME Shell API Reference](https://gjs-docs.gnome.org/shell0.1/)

---

<div align="center">

**¿Te gusta Tux Dock? ¡Dale una ⭐ al repositorio!**

</div>