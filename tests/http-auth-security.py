"""Run against the isolated production test server after CRM smoke checks."""
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3012"

def post(path, body):
    request = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code

statuses = [post("/api/auth/sign-in/email", {"email": "missing.security@example.com", "password": "invalid-synthetic-password"}) for _ in range(4)]
assert statuses[:3] == [401, 401, 401], statuses
assert statuses[3] == 429, statuses
print("PASS: production login rate limiting rejects the fourth failed attempt")
with urllib.request.urlopen(BASE + "/login", timeout=15) as response:
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["X-Robots-Tag"] == "noindex, nofollow"
print("PASS: test deployment security headers")
