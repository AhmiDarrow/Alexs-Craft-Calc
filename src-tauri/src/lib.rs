/// Opens the project repository in the default browser.
/// `CREATE_NO_WINDOW` keeps a console from flashing on the desktop.
#[tauri::command]
fn open_source_repo() -> Result<(), String> {
  const URL: &str = "https://github.com/AhmiDarrow/alexs-craft-calc";
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("rundll32.exe")
      .args(["url.dll,FileProtocolHandler", URL])
      .creation_flags(0x08000000)
      .spawn()
      .map_err(|err| err.to_string())?;
    return Ok(());
  }
  #[cfg(not(windows))]
  {
    let program = if cfg!(target_os = "macos") {
      "open"
    } else {
      "xdg-open"
    };
    std::process::Command::new(program)
      .arg(URL)
      .spawn()
      .map_err(|err| err.to_string())?;
    Ok(())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_source_repo])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
