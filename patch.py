import re

with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

api_fetch = """const API_BASE = `${PROTOCOL_HTTP}${BACKEND_DOMAIN}/api`;

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("session_token");
    if(token) {
        options.headers = options.headers || {};
        options.headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, options);
}"""

c = c.replace('const API_BASE = `${PROTOCOL_HTTP}${BACKEND_DOMAIN}/api`;', api_fetch)
c = re.sub(r'(?<!api)fetch\(', 'apiFetch(', c)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)
