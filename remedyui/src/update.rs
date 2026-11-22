//! Android: a one-time notice when a newer official APK is out.
//!
//! On launch the app asks GitHub for releases of AhmiDarrow/Alexs-Craft-Calc whose tags
//! start with `remedyui-v`, and offers the highest non-draft, non-prerelease version newer
//! than this build. Later quiets the notice for that version; Update downloads the APK
//! (with a progress bar in the app) and opens the system installer. The person still taps
//! Install; their recipes stay on the device. Offline, or after they already chose Later
//! or started the installer for that version, nothing is shown. Never forced, never repeated.
//!
//! Tests can point the check at another URL (`am start --es update_check_url …`) and, if
//! needed, pretend this build is an older version (`--es update_pretend_version 2.1.3`).

use crate::ui::Ctx;

/// Starts the check after the window is up. Other platforms do nothing.
pub fn attach(ctx: &Ctx) {
    #[cfg(target_os = "android")]
    android::attach(ctx);
    #[cfg(not(target_os = "android"))]
    let _ = ctx;
}

/// A release that is newer than this build, with the APK this ABI can install.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Available {
    /// Semver after the `remedyui-v` tag prefix, e.g. `2.1.4`.
    pub version: String,
    pub url: String,
    pub name: String,
}

/// GitHub releases list (not `/latest`, so a tag that is not the newest GitHub release
/// can still win if its semver is higher).
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
const DEFAULT_CHECK_URL: &str = "https://api.github.com/repos/AhmiDarrow/Alexs-Craft-Calc/releases";

/// Parses `2.1.3` or `2.1.3-beta` into a comparable triple. Extra dotted parts are ignored
/// after the patch number.
pub fn parse_semver(s: &str) -> Option<(u32, u32, u32)> {
    let s = s.split('-').next().unwrap_or(s);
    let mut it = s.split('.');
    let major = it.next()?.parse().ok()?;
    let minor = it.next()?.parse().ok()?;
    let patch = it.next()?.parse().ok()?;
    Some((major, minor, patch))
}

/// `remedyui-v2.1.3` → `(2, 1, 3)`. Any other prefix is ignored.
pub fn parse_release_tag(tag: &str) -> Option<(u32, u32, u32)> {
    parse_semver(tag.strip_prefix("remedyui-v")?)
}

/// Asset-name suffix this build can install (`arm64-v8a.apk` on phones, `x86_64.apk` on
/// the usual emulator).
pub fn apk_asset_suffix() -> &'static str {
    if cfg!(target_arch = "x86_64") { "x86_64.apk" } else { "arm64-v8a.apk" }
}

/// Picks the highest non-draft, non-prerelease `remedyui-v*` release newer than `current`
/// that has an APK for this ABI. `body` is the GitHub releases JSON array.
pub fn pick_available(body: &str, current: &str, suffix: &str) -> Option<Available> {
    let current = parse_semver(current)?;
    let releases: Vec<GitHubRelease> = serde_json::from_str(body).ok()?;
    let mut best: Option<((u32, u32, u32), Available)> = None;
    for r in releases {
        if r.draft || r.prerelease {
            continue;
        }
        let Some(ver) = parse_release_tag(&r.tag_name) else { continue };
        if ver <= current {
            continue;
        }
        let Some(asset) = r.assets.iter().find(|a| a.name.ends_with(suffix) && !a.browser_download_url.is_empty())
        else {
            continue;
        };
        let avail = Available {
            version: format!("{}.{}.{}", ver.0, ver.1, ver.2),
            url: asset.browser_download_url.clone(),
            name: safe_apk_name(&asset.name),
        };
        match &best {
            Some((v, _)) if ver <= *v => {}
            _ => best = Some((ver, avail)),
        }
    }
    best.map(|(_, a)| a)
}

fn safe_apk_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or("update.apk");
    if base.ends_with(".apk") && !base.is_empty() { base.to_owned() } else { "update.apk".into() }
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    #[serde(default)]
    browser_download_url: String,
}

use serde::Deserialize;

#[cfg(target_os = "android")]
mod android {
    use super::*;
    use std::io::{Read, Write};
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    use remedy_ui::reactive::{Signal, waker};
    use remedy_ui::widgets::progress;

    use crate::i18n::tr;
    use crate::library::keys;
    use crate::ui::Ctx;
    use crate::ui::tw as w;

    /// Share-folder request name; not numeric, so a later share will not delete it.
    const REQUEST: &str = "update";
    const INDEX: u32 = 0;
    const MIME: &str = "application/vnd.android.package-archive";

    thread_local! {
        static CTX: std::cell::RefCell<Option<Ctx>> = const { std::cell::RefCell::new(None) };
        static PROGRESS: std::cell::RefCell<Option<w::Modal>> = const { std::cell::RefCell::new(None) };
    }

    pub fn attach(ctx: &Ctx) {
        CTX.with(|c| *c.borrow_mut() = Some(ctx.clone()));
        let already: Option<String> = ctx.lib.backing.load(keys::UPDATE_NOTICE).ok().flatten();
        let url = override_value("update_check_url", "update-check-url")
            .unwrap_or_else(|| DEFAULT_CHECK_URL.to_owned());
        let current = override_value("update_pretend_version", "update-pretend-version")
            .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_owned());
        let suffix = apk_asset_suffix();
        // The waker is this UI thread's; the check thread only calls `post` on it.
        let Ok(waker) = waker() else {
            remedy_ui::android::log("update check: no UI waker");
            return;
        };
        remedy_ui::android::log(&format!(
            "update check: current {current}, already {already:?}, url {url}"
        ));
        match std::thread::Builder::new().name("update-check".into()).spawn(move || {
            let Some(avail) = check(&url, &current, suffix) else { return };
            if already.as_deref() == Some(avail.version.as_str()) {
                return;
            }
            let _ = waker.post(move || {
                CTX.with(|c| {
                    if let Some(ctx) = c.borrow().as_ref() {
                        show_notice(ctx, avail);
                    }
                });
            });
        }) {
            Ok(_) => {}
            Err(e) => remedy_ui::android::log(&format!("update check: thread did not start: {e}")),
        }
    }

    /// Launch extra, then an optional one-line file in the app's files dir (for tests
    /// that cannot pass extras).
    fn override_value(extra: &str, file_name: &str) -> Option<String> {
        if let Some(s) = remedy_ui::android::launch_extra(extra) {
            let s = s.trim().to_owned();
            if !s.is_empty() {
                return Some(s);
            }
        }
        let path = remedy_ui::android::data_dir()?.join(file_name);
        let s = std::fs::read_to_string(path).ok()?.trim().to_owned();
        if s.is_empty() { None } else { Some(s) }
    }

    /// `None` when offline, when the response is unusable, or when nothing is newer.
    fn check(url: &str, current: &str, suffix: &str) -> Option<Available> {
        let body = match get_text(url, Duration::from_secs(15)) {
            Ok(b) => b,
            Err(e) => {
                remedy_ui::android::log(&format!("update check skipped: {e}"));
                return None;
            }
        };
        pick_available(&body, current, suffix)
    }

    fn show_notice(ctx: &Ctx, avail: Available) {
        let version = avail.version.clone();
        let title = tr("Update available");
        let message = format!(
            "Alex's Craft Calc {} is available. Your recipes stay on this device when you update.",
            avail.version
        );
        let later_ctx = ctx.clone();
        let later_ver = version.clone();
        let update_ctx = ctx.clone();
        let _ = w::dialog(
            &ctx.ui,
            title,
            message,
            vec![
                w::DialogButton::new(tr("Update"), "primary", move || start_download(&update_ctx, avail.clone())),
                w::DialogButton::new(tr("Later"), "quiet", move || remember(&later_ctx, &later_ver)),
            ],
        );
    }

    fn remember(ctx: &Ctx, version: &str) {
        let _ = ctx.lib.backing.save(keys::UPDATE_NOTICE, &version.to_owned());
        let _ = ctx.lib.backing.flush();
    }

    fn start_download(ctx: &Ctx, avail: Available) {
        let frac: Signal<Option<f32>> = Signal::new(None);
        let cancel = Arc::new(AtomicBool::new(false));
        let gap = ctx.ui.theme().spacing.unit * 2.0;
        let label = tr("Downloading the update");
        let body = ctx
            .ui
            .el("update_download")
            .column()
            .gap(gap)
            .child(w::heading(&ctx.ui, 2, label.clone()))
            .child(progress(&ctx.ui, label, frac));
        let modal = w::modal(&ctx.ui, tr("Downloading the update"), body, false);
        let row = ctx.ui.el("update_download_actions").row().gap(gap).justify(remedy_ui::layout::Justify::End);
        // Cancel is optional; the bar is the main thing.
        let cancel_row = row.child(w::button(&ctx.ui, tr("Cancel"), {
            let cancel = cancel.clone();
            let modal = modal.clone();
            move || {
                cancel.store(true, Ordering::Relaxed);
                modal.close();
            }
        }).variant("quiet"));
        let _ = modal.body().child(cancel_row);
        PROGRESS.with(|slot| *slot.borrow_mut() = Some(modal));
        let version = avail.version.clone();
        let Ok(waker) = waker() else {
            remedy_ui::android::log("update download: no UI waker");
            return;
        };
        let progress_waker = waker.clone();
        let _ = std::thread::Builder::new().name("update-download".into()).spawn(move || {
            let result = download_and_install(&avail, frac, cancel.as_ref(), &progress_waker);
            let _ = waker.post(move || {
                    PROGRESS.with(|slot| {
                        if let Some(m) = slot.borrow_mut().take() {
                            m.close();
                        }
                    });
                    CTX.with(|c| {
                        let binding = c.borrow();
                        let Some(ctx) = binding.as_ref() else { return };
                        match result {
                            Ok(()) => remember(ctx, &version),
                            Err(DownloadErr::Cancelled) => {}
                            Err(DownloadErr::Failed(msg)) => {
                                ctx.toast(&format!("The update could not be downloaded. {msg}"));
                            }
                            Err(DownloadErr::NeedPermission) => {
                                ctx.toast(
                                    "Allow installs from this app in Settings, then open the app and tap Update again.",
                                );
                            }
                        }
                    });
                });
        });
    }

    enum DownloadErr {
        Cancelled,
        NeedPermission,
        Failed(String),
    }

    fn download_and_install(
        avail: &Available,
        frac: Signal<Option<f32>>,
        cancel: &AtomicBool,
        ui: &remedy_ui::reactive::Waker,
    ) -> Result<(), DownloadErr> {
        let dir = cache_share_dir().map_err(DownloadErr::Failed)?;
        std::fs::create_dir_all(&dir).map_err(|e| DownloadErr::Failed(e.to_string()))?;
        let path = dir.join(&avail.name);
        if let Err(e) = download_to(&avail.url, &path, frac, cancel, ui) {
            let _ = std::fs::remove_file(&path);
            return Err(e);
        }
        if cancel.load(Ordering::Relaxed) {
            let _ = std::fs::remove_file(&path);
            return Err(DownloadErr::Cancelled);
        }
        match remedy_ui::android::install_apk(REQUEST, INDEX, MIME, &avail.name) {
            Ok(remedy_ui::android::ApkInstall::Started) => {
                remedy_ui::android::log("update: system installer started");
                Ok(())
            }
            Ok(remedy_ui::android::ApkInstall::NeedPermission) => {
                remedy_ui::android::log("update: install permission is off");
                Err(DownloadErr::NeedPermission)
            }
            Err(e) => {
                remedy_ui::android::log(&format!("update: installer failed: {e}"));
                Err(DownloadErr::Failed(e))
            }
        }
    }

    fn cache_share_dir() -> Result<std::path::PathBuf, String> {
        let data = remedy_ui::android::data_dir().ok_or_else(|| "the app data folder is not ready".to_owned())?;
        let cache = data.parent().ok_or_else(|| "the cache folder is missing".to_owned())?.join("cache");
        Ok(cache.join("remedy-share").join(REQUEST).join(INDEX.to_string()))
    }

    fn user_agent() -> String {
        format!(
            "Alexs-Craft-Calc/{} (+https://github.com/AhmiDarrow/Alexs-Craft-Calc)",
            env!("CARGO_PKG_VERSION")
        )
    }

    fn get_text(url: &str, timeout: Duration) -> Result<String, String> {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(timeout))
            .user_agent(user_agent())
            .build()
            .new_agent();
        let mut resp = agent.get(url).call().map_err(ureq_err)?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }
        resp.body_mut().read_to_string().map_err(|e| e.to_string())
    }

    fn download_to(
        url: &str,
        path: &std::path::Path,
        frac: Signal<Option<f32>>,
        cancel: &AtomicBool,
        ui: &remedy_ui::reactive::Waker,
    ) -> Result<(), DownloadErr> {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(600)))
            .user_agent(user_agent())
            .build()
            .new_agent();
        let mut resp = agent.get(url).call().map_err(|e| DownloadErr::Failed(ureq_err(e)))?;
        if !resp.status().is_success() {
            return Err(DownloadErr::Failed(format!("HTTP {}", resp.status())));
        }
        let total = resp.body().content_length();
        let mut reader = resp.body_mut().as_reader();
        let mut file = std::fs::File::create(path).map_err(|e| DownloadErr::Failed(e.to_string()))?;
        let mut buf = [0u8; 64 * 1024];
        let mut got: u64 = 0;
        let mut last_posted = 0u64;
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err(DownloadErr::Cancelled);
            }
            let n = reader.read(&mut buf).map_err(|e| DownloadErr::Failed(e.to_string()))?;
            if n == 0 {
                break;
            }
            file.write_all(&buf[..n]).map_err(|e| DownloadErr::Failed(e.to_string()))?;
            got += n as u64;
            if let Some(total) = total.filter(|&t| t > 0) {
                // A few UI posts are enough; every 64 KiB (or the last byte) is plenty.
                if got == total || got.saturating_sub(last_posted) >= 64 * 1024 {
                    last_posted = got;
                    let p = (got as f32 / total as f32).clamp(0.0, 1.0);
                    let _ = ui.post(move || frac.set(Some(p)));
                }
            }
        }
        file.flush().map_err(|e| DownloadErr::Failed(e.to_string()))?;
        Ok(())
    }

    fn ureq_err(err: ureq::Error) -> String {
        // Keep the message short and useful; a timeout or DNS failure is "offline" to us.
        let s = err.to_string();
        if s.contains("timed out") || s.contains("timeout") || s.contains("dns") || s.contains("Network")
            || s.contains("Connection") || s.contains("offline")
        {
            "offline".into()
        } else {
            s
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"[
      {
        "tag_name": "v1.0.10",
        "draft": false,
        "prerelease": false,
        "assets": [{"name": "app.apk", "browser_download_url": "http://x/old.apk"}]
      },
      {
        "tag_name": "remedyui-v2.1.4",
        "draft": false,
        "prerelease": false,
        "assets": [
          {"name": "alexs-craft-calc_2.1.4_arm64-v8a.apk", "browser_download_url": "http://x/arm.apk"},
          {"name": "alexs-craft-calc_2.1.4_x86_64.apk", "browser_download_url": "http://x/x64.apk"}
        ]
      },
      {
        "tag_name": "remedyui-v2.1.5",
        "draft": true,
        "prerelease": false,
        "assets": [{"name": "alexs-craft-calc_2.1.5_x86_64.apk", "browser_download_url": "http://x/d.apk"}]
      },
      {
        "tag_name": "remedyui-v2.1.6",
        "draft": false,
        "prerelease": true,
        "assets": [{"name": "alexs-craft-calc_2.1.6_x86_64.apk", "browser_download_url": "http://x/p.apk"}]
      },
      {
        "tag_name": "remedyui-v2.1.3",
        "draft": false,
        "prerelease": false,
        "assets": [{"name": "alexs-craft-calc_2.1.3_x86_64.apk", "browser_download_url": "http://x/same.apk"}]
      }
    ]"#;

    #[test]
    fn parse_release_tags() {
        assert_eq!(parse_release_tag("remedyui-v2.1.4"), Some((2, 1, 4)));
        assert_eq!(parse_release_tag("remedyui-v2.1.4-beta"), Some((2, 1, 4)));
        assert_eq!(parse_release_tag("v2.1.4"), None);
        assert_eq!(parse_release_tag("remedyui-2.1.4"), None);
        assert_eq!(parse_semver("2.1.3"), Some((2, 1, 3)));
    }

    #[test]
    fn picks_highest_stable_newer_for_abi() {
        let got = pick_available(SAMPLE, "2.1.3", "x86_64.apk").unwrap();
        assert_eq!(
            got,
            Available {
                version: "2.1.4".into(),
                url: "http://x/x64.apk".into(),
                name: "alexs-craft-calc_2.1.4_x86_64.apk".into(),
            }
        );
        let arm = pick_available(SAMPLE, "2.1.3", "arm64-v8a.apk").unwrap();
        assert_eq!(arm.url, "http://x/arm.apk");
        assert!(pick_available(SAMPLE, "2.1.4", "x86_64.apk").is_none());
        assert!(pick_available(SAMPLE, "2.1.3", "armeabi-v7a.apk").is_none());
        assert!(pick_available("not json", "2.1.3", "x86_64.apk").is_none());
    }

    #[test]
    fn prefers_higher_semver_out_of_order() {
        let body = r#"[
          {"tag_name":"remedyui-v2.1.5","draft":false,"prerelease":false,
           "assets":[{"name":"a_x86_64.apk","browser_download_url":"http://x/5.apk"}]},
          {"tag_name":"remedyui-v2.2.0","draft":false,"prerelease":false,
           "assets":[{"name":"a_x86_64.apk","browser_download_url":"http://x/20.apk"}]},
          {"tag_name":"remedyui-v2.1.9","draft":false,"prerelease":false,
           "assets":[{"name":"a_x86_64.apk","browser_download_url":"http://x/9.apk"}]}
        ]"#;
        let got = pick_available(body, "2.1.3", "x86_64.apk").unwrap();
        assert_eq!(got.version, "2.2.0");
        assert_eq!(got.url, "http://x/20.apk");
    }
}
