//! Local image proxy protocol (`fyodor-cdn`) so the webview can load
//! Cloudflare-gated CDNs without base64 IPC round-trips.
//!
//! Windows URL form: `http://fyodor-cdn.localhost/atsu/static/...`

use tauri::{
    http::{header, Request, Response, StatusCode},
    UriSchemeContext, UriSchemeResponder,
};

use crate::providers::http;

const ATSU_SITE: &str = "https://atsu.moe";
const ATSU_CDN: &str = "https://cdn.atsu.moe";
const MD_UPLOADS: &str = "https://uploads.mangadex.org";

fn mime_for(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".avif") {
        "image/avif"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    }
}

fn map_upstream(uri_path: &str) -> Option<(String, Option<&'static str>, Option<&'static str>)> {
    if let Some(rest) = uri_path.strip_prefix("/atsu/") {
        let path = rest.trim_start_matches('/');
        if !path.starts_with("static/") {
            return None;
        }
        return Some((
            format!("{ATSU_CDN}/{path}"),
            Some(ATSU_SITE),
            Some(ATSU_SITE),
        ));
    }
    if let Some(rest) = uri_path.strip_prefix("/mangadex/") {
        let path = rest.trim_start_matches('/');
        if !path.starts_with("covers/") {
            return None;
        }
        return Some((format!("{MD_UPLOADS}/{path}"), None, None));
    }
    None
}

fn error_response(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(message.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

pub fn handle_request(
    _ctx: UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    tauri::async_runtime::spawn(async move {
        let path = request.uri().path().to_string();
        let Some((upstream, referer, origin)) = map_upstream(&path) else {
            responder.respond(error_response(
                StatusCode::BAD_REQUEST,
                "unsupported fyodor-cdn path",
            ));
            return;
        };

        let mut req = http::client().get(&upstream);
        if let Some(referer) = referer {
            req = req.header("Referer", referer);
        }
        if let Some(origin) = origin {
            req = req.header("Origin", origin);
        }
        req = req.header(
            "Accept",
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        );

        match req.send().await {
            Ok(response) => {
                let status =
                    StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
                if !status.is_success() {
                    responder.respond(error_response(status, &format!("upstream HTTP {status}")));
                    return;
                }
                match response.bytes().await {
                    Ok(bytes) => {
                        if bytes.len() >= 15 {
                            let head = String::from_utf8_lossy(&bytes[..15.min(bytes.len())])
                                .to_ascii_lowercase();
                            if head.contains("<!doctype") || head.contains("<html") {
                                responder.respond(error_response(
                                    StatusCode::FORBIDDEN,
                                    "upstream returned HTML challenge",
                                ));
                                return;
                            }
                        }
                        let built = Response::builder()
                            .status(StatusCode::OK)
                            .header(header::CONTENT_TYPE, mime_for(&path))
                            .header(header::CACHE_CONTROL, "public, max-age=86400")
                            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                            .body(bytes.to_vec());
                        match built {
                            Ok(res) => responder.respond(res),
                            Err(_) => responder.respond(error_response(
                                StatusCode::INTERNAL_SERVER_ERROR,
                                "failed to build response",
                            )),
                        }
                    }
                    Err(err) => responder.respond(error_response(
                        StatusCode::BAD_GATEWAY,
                        &format!("upstream body error: {err}"),
                    )),
                }
            }
            Err(err) => responder.respond(error_response(
                StatusCode::BAD_GATEWAY,
                &format!("upstream fetch failed: {err}"),
            )),
        }
    });
}
