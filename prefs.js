import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * Panel de preferencias de TuxDock - Reorganizado
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

        // ===== SECCIÓN: DOCK =====
        const dockGroup = new Adw.PreferencesGroup({
            title: 'Dock',
            description: 'Configura el aspecto y comportamiento del dock',
        });
        appearancePage.add(dockGroup);

        // --- Tamaño y Ampliación lado a lado ---
        const slidersRow = new Adw.PreferencesRow();

        const slidersOuterBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 24,
            margin_start: 16,
            margin_end: 16,
            margin_top: 12,
            margin_bottom: 12,
            homogeneous: true,
        });

        // === Panel izquierdo: Tamaño ===
        const sizePanel = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            hexpand: true,
        });

        const sizeTitle = new Gtk.Label({
            label: '<b>Tamaño</b>',
            use_markup: true,
            halign: Gtk.Align.START,
        });
        const sizeSubtitle = new Gtk.Label({
            label: '<small>Ajusta el tamaño de los iconos</small>',
            use_markup: true,
            halign: Gtk.Align.START,
            css_classes: ['dim-label'],
        });

        const sizeSliderBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 8,
        });

        const sizeSmallLabel = new Gtk.Label({
            label: '<small>Chico</small>',
            use_markup: true,
        });
        const sizeLargeLabel = new Gtk.Label({
            label: '<small>Grande</small>',
            use_markup: true,
        });

        const sizeScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 32,
                upper: 96,
                step_increment: 4,
            }),
            draw_value: false,
            hexpand: true,
        });
        sizeScale.set_size_request(100, -1);
        settings.bind('icon-size', sizeScale.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);

        sizeSliderBox.append(sizeSmallLabel);
        sizeSliderBox.append(sizeScale);
        sizeSliderBox.append(sizeLargeLabel);

        sizePanel.append(sizeTitle);
        sizePanel.append(sizeSubtitle);
        sizePanel.append(sizeSliderBox);

        // === Panel derecho: Ampliación ===
        const magPanel = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            hexpand: true,
        });

        const magTitle = new Gtk.Label({
            label: '<b>Ampliación</b>',
            use_markup: true,
            halign: Gtk.Align.START,
        });
        const magSubtitle = new Gtk.Label({
            label: '<small>Efecto zoom al pasar cursor</small>',
            use_markup: true,
            halign: Gtk.Align.START,
            css_classes: ['dim-label'],
        });

        const magSliderBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 8,
        });

        const magScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 1.0,
                upper: 3.0,
                step_increment: 0.1,
            }),
            draw_value: false,
            hexpand: true,
        });
        magScale.set_size_request(150, -1);

        // Añadir marcas: Off, Chico, Grande (sin labels en los lados)
        magScale.add_mark(1.0, Gtk.PositionType.BOTTOM, 'Off');
        magScale.add_mark(2.0, Gtk.PositionType.BOTTOM, 'Chico');
        magScale.add_mark(3.0, Gtk.PositionType.BOTTOM, 'Grande');

        // Conectar al setting (1.0 = desactivado)
        const updateMagnification = () => {
            const value = magScale.get_value();
            if (value <= 1.1) {
                settings.set_boolean('magnification-enabled', false);
                settings.set_double('magnification-scale', 1.0);
            } else {
                settings.set_boolean('magnification-enabled', true);
                settings.set_double('magnification-scale', value);
            }
        };

        // Inicializar valor
        if (settings.get_boolean('magnification-enabled')) {
            magScale.set_value(settings.get_double('magnification-scale'));
        } else {
            magScale.set_value(1.0);
        }

        magScale.connect('value-changed', updateMagnification);

        magSliderBox.append(magScale);

        magPanel.append(magTitle);
        magPanel.append(magSubtitle);
        magPanel.append(magSliderBox);

        // Añadir ambos paneles
        slidersOuterBox.append(sizePanel);
        slidersOuterBox.append(magPanel);

        slidersRow.set_child(slidersOuterBox);
        dockGroup.add(slidersRow);

        // --- Posición del dock ---
        const positionRow = new Adw.ComboRow({
            title: 'Posición',
            subtitle: 'Ubicación del dock en la pantalla',
        });

        const positionModel = new Gtk.StringList();
        positionModel.append('Abajo');
        positionModel.append('Izquierda');
        positionModel.append('Derecha');
        positionRow.set_model(positionModel);

        const positionMap = { 'BOTTOM': 0, 'LEFT': 1, 'RIGHT': 2 };
        const positionMapReverse = ['BOTTOM', 'LEFT', 'RIGHT'];

        positionRow.set_selected(positionMap[settings.get_string('position')] || 0);
        positionRow.connect('notify::selected', (widget) => {
            settings.set_string('position', positionMapReverse[widget.selected]);
        });
        dockGroup.add(positionRow);

        // --- Opacidad del dock ---
        const opacityRow = new Adw.ActionRow({
            title: 'Opacidad',
            subtitle: 'Transparencia del fondo del dock',
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
        opacityScale.set_size_request(150, -1);

        opacityScale.connect('value-changed', (widget) => {
            settings.set_double('dock-opacity', widget.get_value() / 100);
        });

        opacityRow.add_suffix(opacityScale);
        dockGroup.add(opacityRow);

        // --- Animación al minimizar ---
        const minimizeAnimRow = new Adw.ComboRow({
            title: 'Animación al minimizar',
            subtitle: 'Efecto cuando se minimiza una ventana',
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
        dockGroup.add(minimizeAnimRow);

        // --- Toggle: Minimizar ventanas al icono ---
        const minimizeToDockRow = new Adw.SwitchRow({
            title: 'Minimizar ventanas al icono',
            subtitle: 'Las ventanas se minimizan hacia su icono en el dock',
        });
        settings.bind('minimize-to-dock', minimizeToDockRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockGroup.add(minimizeToDockRow);

        // --- Toggle: Fondo de iconos ---
        const iconBackgroundRow = new Adw.SwitchRow({
            title: 'Fondo de iconos',
            subtitle: 'Mostrar fondo en los botones de los iconos',
        });
        settings.bind('icon-background', iconBackgroundRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockGroup.add(iconBackgroundRow);

        // --- Toggle: Ocultar y mostrar automáticamente ---
        const autohideRow = new Adw.SwitchRow({
            title: 'Ocultar y mostrar automáticamente',
            subtitle: 'El dock se oculta cuando no está en uso',
        });
        settings.bind('autohide', autohideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockGroup.add(autohideRow);

        // --- Toggle: Animar apertura de apps ---
        const bounceRow = new Adw.SwitchRow({
            title: 'Animar apertura de aplicaciones',
            subtitle: 'Los iconos rebotan al abrir aplicaciones',
        });
        settings.bind('enable-bounce', bounceRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockGroup.add(bounceRow);

        // --- Toggle: Mostrar indicadores ---
        const indicatorsRow = new Adw.SwitchRow({
            title: 'Mostrar indicadores en apps abiertas',
            subtitle: 'Puntos debajo de las aplicaciones en ejecución',
        });
        settings.bind('show-running-indicator', indicatorsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockGroup.add(indicatorsRow);

        // --- Toggle: Mostrar apps recientes y sugeridas ---
        const recentAppsRow = new Adw.SwitchRow({
            title: 'Mostrar apps recientes y sugeridas',
            subtitle: 'Incluir aplicaciones abiertas no fijadas en el dock',
        });
        // Usamos una key que puede no existir, si no existe la creamos
        // Por ahora asumimos que siempre se muestran las apps recientes
        // TODO: Agregar setting 'show-recent-apps' al schema si no existe
        dockGroup.add(recentAppsRow);

        // ====== PÁGINA 2: COMPORTAMIENTO ======
        const behaviorPage = new Adw.PreferencesPage({
            title: 'Comportamiento',
            icon_name: 'preferences-other-symbolic',
        });
        window.add(behaviorPage);

        // ===== SECCIÓN: ICONOS ESPECIALES =====
        const specialIconsGroup = new Adw.PreferencesGroup({
            title: 'Iconos Especiales',
            description: 'Mostrar iconos adicionales en el dock',
        });
        behaviorPage.add(specialIconsGroup);

        // --- Toggle: Papelera ---
        const showTrashRow = new Adw.SwitchRow({
            title: 'Mostrar papelera',
            subtitle: 'Añadir icono de la papelera al dock',
        });
        settings.bind('show-trash', showTrashRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        specialIconsGroup.add(showTrashRow);

        // --- Toggle: Lanzador de apps ---
        const showAppLauncherRow = new Adw.SwitchRow({
            title: 'Mostrar lanzador de aplicaciones',
            subtitle: 'Añadir icono para abrir el cajón de aplicaciones',
        });
        settings.bind('show-app-launcher', showAppLauncherRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        specialIconsGroup.add(showAppLauncherRow);

        // ===== SECCIÓN: INTERACCIONES =====
        const interactionGroup = new Adw.PreferencesGroup({
            title: 'Interacciones',
            description: 'Configura cómo responde el dock a clicks y gestos',
        });
        behaviorPage.add(interactionGroup);

        // --- Acción de clic ---
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

        // --- Acción de clic medio ---
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

        // --- Acción de scroll ---
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

        // ===== SECCIÓN: ACERCA DE =====
        const infoGroup = new Adw.PreferencesGroup({
            title: 'Acerca de',
        });
        behaviorPage.add(infoGroup);

        const aboutRow = new Adw.ActionRow({
            title: 'TuxDock',
            subtitle: 'Un dock estilo macOS para GNOME Shell\nVersión 1.0',
        });
        infoGroup.add(aboutRow);
    }
}
