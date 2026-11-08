# Authenticated SOCKS5 for Profile Workspace

The user authorized the previously proposed built-in local intermediary, so NordVPN can be used as a per-profile proxy without its VPN app. Existing proxy fields remain the configuration interface. Passwords keep using Windows safeStorage.

## Approach

Chromium cannot authenticate to SOCKS5 directly. Use a loopback HTTP proxy backed by the pinned CommonJS proxy-chain library to forward HTTP and CONNECT through authenticated SOCKS5. This avoids implementing the SOCKS wire protocol ourselves. A system VPN cannot provide per-profile proxy assignments and does not meet the request.

Each configured Electron session owns a separate bridge bound to 127.0.0.1 on an ephemeral port, protected with random local credentials. Upstream credentials remain in the main process. Domain names are forwarded to SOCKS for remote resolution. No direct fallback is allowed. Close connections and bridges after checks, profile shutdown, cancelled/failed launches and application exit; replace them on reconfiguration.

Preserve unauthenticated SOCKS5 and HTTP(S) behavior. Validate SOCKS5 credentials against the protocol's 255-byte limit. Update Russian UI hints, README and OVERVIEW, write a NordVPN guide, build a usable portable executable. Verify with a controlled authenticated SOCKS server; actual NordVPN account access remains unverified without the user's service credentials.
