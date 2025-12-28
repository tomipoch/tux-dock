import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * Panel de preferencias de TuxDock
 */
export default class TuxDockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.tux-dock');

        // ====== PÁGINA 1: APARIENCIA ======
        const appearancePage = new Adw.PreferencesPage({
            title: 'Apariencia',
            icon_name: 'applications-graphics-symbolic',
        });
        window.add(appearancePage);

        // Grupo de Iconos
        const iconsGroup = new Adw.PreferencesGroup({
            title: 'Iconos',
            description: 'Configura el tamaño y comportamiento de los iconos',
        });
        appearancePage.add(iconsGroup);

        // Tamaño de iconos
        const iconSizeRow = new Adw.ActionRow({
            title: 'Tamaño de iconos',
            subtitle: 'Ajusta el tamaño base de los iconos (32-96 px)',
        });

        const iconSizeScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 32,
                upper: 96,
                step_increment: 4,
                value: settings.get_int('icon-size'),
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });

        iconSizeScale.set_digits(0);
        settings.bind('icon-size', iconSizeScale.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);

        iconSizeRow.add_suffix(iconSizeScale);
        iconsGroup.add(iconSizeRow);

        // Ampliación
        const magnificationRow = new Adw.ActionRow({
            title: 'Ampliación de iconos',
            subtitle: 'Agranda los iconos al pasar el cursor (estilo macOS)',
        });

        const magnificationSwitch = new Gtk.Switch({
            active: settings.get_boolean('magnification-enabled'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('magnification-enabled', magnificationSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        magnificationRow.add_suffix(magnificationSwitch);
        magnificationRow.set_activatable_widget(magnificationSwitch);
        iconsGroup.add(magnificationRow);

        // Escala de ampliación
        const magnificationScaleRow = new Adw.ActionRow({
            title: 'Intensidad de ampliación',
            subtitle: 'Cuánto se agrandan los iconos (1.0 - 3.0)',
        });

        const magnificationScaleBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            hexpand: true,
        });

        const magnificationScaleScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 1.0,
                upper: 3.0,
                step_increment: 0.1,
                value: settings.get_double('magnification-scale'),
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });

        magnificationScaleScale.set_digits(1);
        magnificationScaleScale.set_size_request(200, -1);
        settings.bind('magnification-scale', magnificationScaleScale.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);


        magnificationScaleBox.append(magnificationScaleScale);
        magnificationScaleRow.add_suffix(magnificationScaleBox);
        iconsGroup.add(magnificationScaleRow);

        // Grupo de Estilo del Dock
        const dockStyleGroup = new Adw.PreferencesGroup({
            title: 'Estilo del Dock',
            description: 'Personaliza la apariencia del contenedor del dock',
        });
        appearancePage.add(dockStyleGroup);

        // Posición del dock
        const positionRow = new Adw.ComboRow({
            title: 'Posición del dock',
            subtitle: 'Ubicación del dock en la pantalla',
        });

        const positionModel = new Gtk.StringList();
        positionModel.append('Abajo');
        positionModel.append('Izquierda');
        positionModel.append('Derecha');
        positionRow.set_model(positionModel);

        // Mapear valores
        const positionMap = { 'BOTTOM': 0, 'LEFT': 1, 'RIGHT': 2 };
        const positionMapReverse = ['BOTTOM', 'LEFT', 'RIGHT'];

        const currentPosition = settings.get_string('position');
        positionRow.set_selected(positionMap[currentPosition] || 0);

        positionRow.connect('notify::selected', (widget) => {
            settings.set_string('position', positionMapReverse[widget.selected]);
        });

        dockStyleGroup.add(positionRow);

        // Opacidad del dock
        const opacityRow = new Adw.ActionRow({
            title: 'Opacidad del fondo',
            subtitle: 'Transparencia del fondo del dock (0-100%)',
        });

        const opacityScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 5,
                value: settings.get_double('dock-opacity') * 100,
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });

        opacityScale.set_digits(0);
        opacityScale.connect('value-changed', (widget) => {
            settings.set_double('dock-opacity', widget.get_value() / 100);
        });

        opacityRow.add_suffix(opacityScale);
        dockStyleGroup.add(opacityRow);

        // Margen del dock
        const marginRow = new Adw.ActionRow({
            title: 'Margen del dock',
            subtitle: 'Distancia desde el borde de la pantalla (0-50 px)',
        });

        const marginSpinner = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 50,
                step_increment: 2,
                value: settings.get_int('dock-margin'),
            }),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('dock-margin', marginSpinner, 'value', Gio.SettingsBindFlags.DEFAULT);

        marginRow.add_suffix(marginSpinner);
        dockStyleGroup.add(marginRow);

        // ====== PÁGINA 2: COMPORTAMIENTO ======
        const behaviorPage = new Adw.PreferencesPage({
            title: 'Comportamiento',
            icon_name: 'preferences-other-symbolic',
        });
        window.add(behaviorPage);

        // Grupo de Visibilidad
        const visibilityGroup = new Adw.PreferencesGroup({
            title: 'Visibilidad',
            description: 'Controla cuándo se muestra u oculta el dock',
        });
        behaviorPage.add(visibilityGroup);

        // Ocultamiento automático
        const autohideRow = new Adw.ActionRow({
            title: 'Ocultamiento automático',
            subtitle: 'El dock se oculta cuando no está en uso',
        });

        const autohideSwitch = new Gtk.Switch({
            active: settings.get_boolean('autohide'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('autohide', autohideSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        autohideRow.add_suffix(autohideSwitch);
        autohideRow.set_activatable_widget(autohideSwitch);
        visibilityGroup.add(autohideRow);

        // Indicadores de ventanas
        const indicatorsRow = new Adw.ActionRow({
            title: 'Mostrar indicadores',
            subtitle: 'Muestra puntos debajo de las apps abiertas',
        });

        const indicatorsSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-running-indicator'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('show-running-indicator', indicatorsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        indicatorsRow.add_suffix(indicatorsSwitch);
        indicatorsRow.set_activatable_widget(indicatorsSwitch);
        visibilityGroup.add(indicatorsRow);

        // Ocultamiento inteligente
        const intellihideRow = new Adw.ActionRow({
            title: 'Ocultamiento inteligente',
            subtitle: 'Oculta el dock solo cuando una ventana lo cubre',
        });

        const intellihideSwitch = new Gtk.Switch({
            active: settings.get_boolean('intellihide'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('intellihide', intellihideSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        intellihideRow.add_suffix(intellihideSwitch);
        intellihideRow.set_activatable_widget(intellihideSwitch);
        visibilityGroup.add(intellihideRow);

        // Empujar ventanas
        const pushWindowsRow = new Adw.ActionRow({
            title: 'Reservar espacio para el dock',
            subtitle: 'Las ventanas maximizadas no cubren el dock',
        });

        const pushWindowsSwitch = new Gtk.Switch({
            active: settings.get_boolean('push-windows'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('push-windows', pushWindowsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        pushWindowsRow.add_suffix(pushWindowsSwitch);
        pushWindowsRow.set_activatable_widget(pushWindowsSwitch);
        visibilityGroup.add(pushWindowsRow);

        // Minimizar al dock
        const minimizeToDockRow = new Adw.ActionRow({
            title: 'Minimizar al dock',
            subtitle: 'Las ventanas se minimizan a su icono',
        });

        const minimizeToDockSwitch = new Gtk.Switch({
            active: settings.get_boolean('minimize-to-dock'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('minimize-to-dock', minimizeToDockSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        minimizeToDockRow.add_suffix(minimizeToDockSwitch);
        minimizeToDockRow.set_activatable_widget(minimizeToDockSwitch);
        visibilityGroup.add(minimizeToDockRow);

        // Grupo de Interacción
        const interactionGroup = new Adw.PreferencesGroup({
            title: 'Interacción',
            description: 'Configura cómo responde el dock a clicks y gestos',
        });
        behaviorPage.add(interactionGroup);

        // Acción de clic
        const clickActionRow = new Adw.ComboRow({
            title: 'Acción al hacer clic',
            subtitle: 'Qué hace el clic izquierdo en un icono',
        });

        const clickActionModel = new Gtk.StringList();
        clickActionModel.append('Enfocar o lanzar');
        clickActionModel.append('Minimizar o enfocar');
        clickActionModel.append('Mostrar previsualizaciones');
        clickActionRow.set_model(clickActionModel);

        const clickMap = { 'focus-or-launch': 0, 'minimize-or-focus': 1, 'previews': 2 };
        const clickMapReverse = ['focus-or-launch', 'minimize-or-focus', 'previews'];

        clickActionRow.set_selected(clickMap[settings.get_string('click-action')] || 0);

        clickActionRow.connect('notify::selected', (widget) => {
            settings.set_string('click-action', clickMapReverse[widget.selected]);
        });

        interactionGroup.add(clickActionRow);

        // Acción de clic medio
        const middleClickRow = new Adw.ComboRow({
            title: 'Acción del clic medio',
            subtitle: 'Qué hace el clic medio en un icono',
        });

        const middleClickModel = new Gtk.StringList();
        middleClickModel.append('Nueva ventana');
        middleClickModel.append('Minimizar');
        middleClickModel.append('Cerrar aplicación');
        middleClickRow.set_model(middleClickModel);

        const middleMap = { 'new-window': 0, 'minimize': 1, 'quit': 2 };
        const middleMapReverse = ['new-window', 'minimize', 'quit'];

        middleClickRow.set_selected(middleMap[settings.get_string('middle-click-action')] || 0);

        middleClickRow.connect('notify::selected', (widget) => {
            settings.set_string('middle-click-action', middleMapReverse[widget.selected]);
        });

        interactionGroup.add(middleClickRow);

        // Acción de scroll
        const scrollActionRow = new Adw.ComboRow({
            title: 'Acción de la rueda del ratón',
            subtitle: 'Qué hace el scroll sobre un icono',
        });

        const scrollActionModel = new Gtk.StringList();
        scrollActionModel.append('Cambiar entre ventanas');
        scrollActionModel.append('Nada');
        scrollActionRow.set_model(scrollActionModel);

        const scrollMap = { 'cycle-windows': 0, 'nothing': 1 };
        const scrollMapReverse = ['cycle-windows', 'nothing'];

        scrollActionRow.set_selected(scrollMap[settings.get_string('scroll-action')] || 0);

        scrollActionRow.connect('notify::selected', (widget) => {
            settings.set_string('scroll-action', scrollMapReverse[widget.selected]);
        });

        interactionGroup.add(scrollActionRow);

        // ====== PÁGINA 3: ANIMACIONES Y EXTRAS ======
        const animationsPage = new Adw.PreferencesPage({
            title: 'Animaciones',
            icon_name: 'preferences-desktop-animation-symbolic',
        });
        window.add(animationsPage);

        // Grupo de Iconos Especiales
        const specialIconsGroup = new Adw.PreferencesGroup({
            title: 'Iconos Especiales',
            description: 'Mostrar iconos especiales en el dock',
        });
        animationsPage.add(specialIconsGroup);

        // Mostrar papelera
        const showTrashRow = new Adw.ActionRow({
            title: 'Mostrar papelera',
            subtitle: 'Añadir icono de la papelera al dock',
        });

        const showTrashSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-trash'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('show-trash', showTrashSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        showTrashRow.add_suffix(showTrashSwitch);
        showTrashRow.set_activatable_widget(showTrashSwitch);
        specialIconsGroup.add(showTrashRow);

        // Mostrar lanzador de aplicaciones
        const showAppLauncherRow = new Adw.ActionRow({
            title: 'Mostrar lanzador de apps',
            subtitle: 'Añadir icono para abrir el cajón de aplicaciones',
        });

        const showAppLauncherSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-app-launcher'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('show-app-launcher', showAppLauncherSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        showAppLauncherRow.add_suffix(showAppLauncherSwitch);
        showAppLauncherRow.set_activatable_widget(showAppLauncherSwitch);
        specialIconsGroup.add(showAppLauncherRow);

        // Grupo de Animaciones
        const animationsGroup = new Adw.PreferencesGroup({
            title: 'Animaciones',
            description: 'Configurar efectos de animación',
        });

        animationsPage.add(animationsGroup);

        // Animación de lanzamiento
        const bounceRow = new Adw.ActionRow({
            title: 'Animar lanzamiento de apps',
            subtitle: 'Los iconos rebotan al abrir aplicaciones',
        });

        const bounceSwitch = new Gtk.Switch({
            active: settings.get_boolean('enable-bounce'),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('enable-bounce', bounceSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        bounceRow.add_suffix(bounceSwitch);
        bounceRow.set_activatable_widget(bounceSwitch);
        animationsGroup.add(bounceRow);

        // Animación de minimizar
        const minimizeAnimRow = new Adw.ComboRow({
            title: 'Efecto al minimizar',
            subtitle: 'Animación cuando se minimiza una ventana',
        });

        const minimizeAnimModel = new Gtk.StringList();
        minimizeAnimModel.append('Escala');
        minimizeAnimModel.append('Genie');
        minimizeAnimModel.append('Ninguna');
        minimizeAnimRow.set_model(minimizeAnimModel);

        const minimizeMap = { 'scale': 0, 'genie': 1, 'none': 2 };
        const minimizeMapReverse = ['scale', 'genie', 'none'];

        minimizeAnimRow.set_selected(minimizeMap[settings.get_string('minimize-animation')] || 0);

        minimizeAnimRow.connect('notify::selected', (widget) => {
            settings.set_string('minimize-animation', minimizeMapReverse[widget.selected]);
        });

        animationsGroup.add(minimizeAnimRow);

        // Duración de animaciones
        const animDurationRow = new Adw.ActionRow({
            title: 'Duración de animaciones',
            subtitle: 'Velocidad de las animaciones (0-1000 ms)',
        });

        const animDurationSpinner = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 1000,
                step_increment: 50,
                value: settings.get_int('animation-duration'),
            }),
            valign: Gtk.Align.CENTER,
        });

        settings.bind('animation-duration', animDurationSpinner, 'value', Gio.SettingsBindFlags.DEFAULT);

        animDurationRow.add_suffix(animDurationSpinner);
        animationsGroup.add(animDurationRow);

        // Grupo de Información
        const infoGroup = new Adw.PreferencesGroup({
            title: 'Acerca de',
        });

        animationsPage.add(infoGroup);

        const aboutRow = new Adw.ActionRow({
            title: 'TuxDock',
            subtitle: 'Un dock estilo macOS para GNOME Shell\nVersión 1.0',
        });

        infoGroup.add(aboutRow);
    }
}
