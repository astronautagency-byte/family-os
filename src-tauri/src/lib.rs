#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init());

    // Windows and Linux launch a second process with the deep-link URL as an
    // argument. The single-instance plugin forwards that URL to the same event
    // consumed by the JavaScript deep-link listener. macOS/mobile continue to
    // use the native deep-link event directly.
    #[cfg(desktop)]
    {
        use tauri::Emitter;
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let urls: Vec<String> = argv.into_iter().filter(|arg| arg.starts_with("famos://")).collect();
            if !urls.is_empty() {
                let _ = app.emit("deep-link://new-url", urls);
            }
        }));
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running FamOS");
}
