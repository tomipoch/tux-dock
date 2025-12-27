### 1) Requerimientos funcionales (lo que debe hacer)

#### Núcleo del dock
- Mostrar barra tipo dock
- Posición configurable (abajo, izquierda, derecha)
- Tamaño configurable
- Soportar iconos de aplicaciones

#### Aplicaciones
- Mostrar apps fijadas
- Mostrar apps abiertas no fijadas
- Permitir fijar/desfijar apps
- Reordenar iconos mediante arrastrar y soltar
- Click izquierdo abre o enfoca app
- Click medio (opcional) abre nueva ventana

#### Indicadores de estado
- Indicador de app abierta
- Indicador de múltiples ventanas
- Badge con contador opcional
- Icono resaltado para app en foco

#### Comportamiento visual
- Ocultamiento automático opcional
- Mostrar sobre ventanas o empujar ventanas
- Animaciones suaves básicas
- Soporte para modo claro/oscuro del sistema

---

### 2) Requerimientos “tipo macOS” (objetivo del proyecto)

- Magnificación por proximidad del puntero
- Rebote (bounce) para notificaciones
- Minimizar al icono del dock
- Stacks de carpetas (grid/lista)
- Vista previa simple al pasar cursor
- Arrastrar archivo → soltar sobre app para abrirlo
- Arrastrar app → fijar en dock
- Papelera opcional en el dock

---

### 3) Requerimientos técnicos

- Implementada como **GNOME Shell Extension**
- Lenguaje: **JavaScript (GJS)**
- UI: **St toolkit**
- Estilos: **CSS propio**

#### Compatibilidad mínima
- GNOME 45+ (ajusta según tu máquina real)

#### Manejo de configuraciones
- GSettings (org.gnome.shell.extensions.<tu-dock>)

#### APIs del shell relevantes
- Main (layout y actores)
- Shell.AppSystem
- Shell.WindowTracker
- AppFavorites
- WorkspaceManager

---

### 4) Integraciones necesarias

- Favoritos del sistema (gsettings)
- Ventanas abiertas
- Multi-monitor
- HiDPI / escalado
- Entradas táctiles y mouse

#### Opcional avanzado
- MPRIS via DBus para controles multimedia
- Notificaciones D-Bus para bounce o badges

---

### 5) Requerimientos de usabilidad

- Configuración gráfica (panel prefs)
- Tamaño de icono configurable
- Nivel de magnificación configurable
- Borde/trasparencia configurable
- Accesibilidad básica (teclado y focus)

---

### 6) Requerimientos no funcionales

- Rendimiento fluido
- Mínimo uso de CPU en reposo
- Manejo correcto en Wayland (Fedora)
- No romper overview/activities
- Manejo de fallos: desactivar limpia sin dejar artefactos

---

### 7) Requerimientos opcionales “pro”

- Compatibilidad con Dash-to-Dock desactivada
- Exportación/importación de configuración
- Perfiles de apariencia
- Soporte para temas externos

---

### 8) Roadmap sugerido en fases

#### Fase 1 – MVP funcional
- Dock básico visible
- Iconos de apps abiertas
- Click para abrir/enfocar
- Ocultamiento automático simple

#### Fase 2 – calidad dock
- Fijar aplicaciones
- Arrastrar y soltar
- Indicadores de estado
- Configuración básica

#### Fase 3 – estilo macOS
- Magnificación
- Animaciones pulidas
- Rebote de notificación

#### Fase 4 – extras
- Stacks
- Widgets multimedia
- Badges avanzados
