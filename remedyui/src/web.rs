//! What only a browser page does: print a page through the browser's print dialog.

use wasm_bindgen::JsCast;

/// Prints `html` through a hidden frame and the browser's print dialog.
pub fn print_html(html: &str) -> Result<(), String> {
    let err = |e: wasm_bindgen::JsValue| format!("{e:?}");
    let window = web_sys::window().ok_or("no window")?;
    let document = window.document().ok_or("no document")?;
    let frame = document.create_element("iframe").map_err(err)?;
    frame.set_attribute("style", "position:fixed;width:0;height:0;border:0;right:0;bottom:0").map_err(err)?;
    frame.set_attribute("srcdoc", html).map_err(err)?;
    let body = document.body().ok_or("no body")?;
    body.append_child(&frame).map_err(err)?;
    let frame: web_sys::HtmlIFrameElement = frame.dyn_into().map_err(|_| "not a frame".to_owned())?;
    let f2 = frame.clone();
    let onload = wasm_bindgen::closure::Closure::once_into_js(move || {
        if let Some(w) = f2.content_window() {
            let _ = w.print();
        }
    });
    frame.set_onload(Some(onload.unchecked_ref()));
    Ok(())
}
