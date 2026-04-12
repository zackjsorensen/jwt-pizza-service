#!/usr/bin/env bash

# Simple traffic simulator for JWT Pizza service.
# Generates mostly normal activity:
# - menu reads, registrations, logins, small orders, logouts
# - large orders (20+ pizzas) at most about once every 8 minutes
# - occasional wrong-password logins, capped at 2 per clock minute
#
# Usage:
#   ./simulateTraffic.sh [base_url] [sleep_seconds]
# Example:
#   ./simulateTraffic.sh http://localhost:3000 2

set -eo pipefail

BASE_URL="${1:-http://localhost:3000}"
SLEEP_SECONDS="${2:-2}"

# Seconds between "large" (20+ pizza) orders — ~8 minutes
LARGE_ORDER_MIN_INTERVAL=480

echo "Simulating traffic against ${BASE_URL} every ${SLEEP_SECONDS}s"
echo "Press Ctrl+C to stop."

# In-memory tokens per email after login/registration
declare -A TOKENS

USER_PASSWORD="pizzapw"

# Large orders: don't fire one immediately on startup
LAST_LARGE_ORDER_EPOCH=$(date +%s)

# Wrong-login cap: at most 2 failed logins per local clock minute
BAD_LOGIN_MINUTE=-1
BAD_LOGIN_COUNT=0

random_index() {
  local max="$1"
  echo $((RANDOM % max))
}

random_name() {
  echo "user$RANDOM$RANDOM"
}

random_email() {
  echo "$(random_name)@test.com"
}

bad_login_quota_remaining() {
  local now_minute=$(( $(date +%s) / 60 ))
  if (( now_minute != BAD_LOGIN_MINUTE )); then
    BAD_LOGIN_MINUTE=$now_minute
    BAD_LOGIN_COUNT=0
  fi
  (( BAD_LOGIN_COUNT < 2 ))
}

register_user() {
  local name
  name=$(random_name)
  local email
  email=$(random_email)

  echo ""
  echo "==> Registering user: $name <$email>"
  curl -s -o /tmp/reg.json -w " HTTP_%{http_code}\n" \
    -X POST "${BASE_URL}/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\",\"email\":\"${email}\",\"password\":\"${USER_PASSWORD}\"}"

  if jq -e '.token' /tmp/reg.json >/dev/null 2>&1; then
    local token
    token=$(jq -r '.token' /tmp/reg.json)
    TOKENS["$email"]="$token"
    echo "Registered and stored token for $email"
  fi
}

login_user() {
  # Only log in known users so traffic looks like real usage (no random guaranteed failures here).
  local email_list=()
  for e in "${!TOKENS[@]}"; do
    email_list+=("$e")
  done
  local count=${#email_list[@]}
  if (( count == 0 )); then
    echo ""
    echo "==> No users yet; registering instead of login."
    register_user
    return
  fi

  local idx
  idx=$(random_index "$count")
  local email="${email_list[$idx]}"

  echo ""
  echo "==> Logging in user: $email"
  curl -s -o /tmp/login.json -w " HTTP_%{http_code}\n" \
    -X PUT "${BASE_URL}/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${USER_PASSWORD}\"}"

  if jq -e '.token' /tmp/login.json >/dev/null 2>&1; then
    local token
    token=$(jq -r '.token' /tmp/login.json)
    TOKENS["$email"]="$token"
    echo "Logged in and stored token for $email"
  fi
}

bad_login_user() {
  echo ""
  if ! bad_login_quota_remaining; then
    echo "==> Bad login skipped (already at 2 failed logins this minute); fetching menu instead"
    curl -s -o /tmp/menu.json -w " HTTP_%{http_code}\n" \
      "${BASE_URL}/api/order/menu"
    return
  fi

  local email
  email=$(random_email)

  echo "==> Wrong-password login attempt for: $email"
  curl -s -o /tmp/login_bad.json -w " HTTP_%{http_code}\n" \
    -X PUT "${BASE_URL}/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"wrongpw\"}"

  ((++BAD_LOGIN_COUNT)) || true
}

logout_user() {
  local email_list=()
  for e in "${!TOKENS[@]}"; do
    email_list+=("$e")
  done
  local count=${#email_list[@]}
  if (( count == 0 )); then
    echo ""
    echo "==> No logged-in users to log out."
    return
  fi

  local idx
  idx=$(random_index "$count")
  local email="${email_list[$idx]}"
  local token="${TOKENS[$email]}"

  echo ""
  echo "==> Logging out user: $email"
  curl -s -o /tmp/logout.json -w " HTTP_%{http_code}\n" \
    -X DELETE "${BASE_URL}/api/auth" \
    -H "Authorization: Bearer ${token}"

  unset TOKENS["$email"]
}

get_menu() {
  echo ""
  echo "==> Getting menu"
  curl -s -o /tmp/menu.json -w " HTTP_%{http_code}\n" \
    "${BASE_URL}/api/order/menu"
}

create_order() {
  local email_list=()
  for e in "${!TOKENS[@]}"; do
    email_list+=("$e")
  done
  local count=${#email_list[@]}
  if (( count == 0 )); then
    echo ""
    echo "==> No logged-in users to create order; logging in."
    login_user
    return
  fi

  local idx
  idx=$(random_index "$count")
  local email="${email_list[$idx]}"
  local token="${TOKENS[$email]}"

  local now
  now=$(date +%s)
  local item_count
  if (( now - LAST_LARGE_ORDER_EPOCH >= LARGE_ORDER_MIN_INTERVAL )); then
    item_count=$((20 + RANDOM % 10)) # 20–29 pizzas, ~every 8 minutes
    LAST_LARGE_ORDER_EPOCH=$now
    echo ""
    echo "==> Creating scheduled LARGE order (${item_count} pizzas)"
  else
    # Typical small orders: 1–5 pizzas
    item_count=$((1 + RANDOM % 5))
  fi

  local items_json='[]'
  for ((i=0; i<item_count; i++)); do
    local price="0.0$((10 + RANDOM % 90))"
    local item
    item=$(jq -nc --arg desc "Item $i" --arg price "$price" '{menuId:1, description:$desc, price:($price|tonumber)}')
    items_json=$(echo "$items_json" | jq --argjson item "$item" '. + [$item]')
  done

  local order_body
  order_body=$(jq -nc --argjson items "$items_json" '{franchiseId:1, storeId:1, items:$items}')

  echo ""
  echo "==> Creating order for $email with $item_count item(s)"
  curl -s -o /tmp/order.json -w " HTTP_%{http_code}\n" \
    -X POST "${BASE_URL}/api/order" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${token}" \
    -d "$order_body"
}

# Extra anonymous reads to mimic real "browsing" traffic
maybe_extra_menu() {
  if (( RANDOM % 3 == 0 )); then
    echo ""
    echo "==> Extra menu fetch (browse)"
    curl -s -o /tmp/menu2.json -w " HTTP_%{http_code}\n" \
      "${BASE_URL}/api/order/menu"
  fi
}

random_action() {
  # Heavier on menu, orders, and successful auth; rare wrong logins (rate-limited).
  case $((RANDOM % 100)) in
    [0-9]|[1-2][0-9]|[3][0-4]) get_menu ;;           # 0–34: 35% menu
    [3][5-9]|[4][0-9]|[5][0-9]) create_order ;;      # 35–59: 25% order
    [6][0-9]|[7][0-4]) login_user ;;                 # 60–74: 15% login
    [7][5-9]|[8][0-2]) register_user ;;              # 75–82: 8% register
    [8][3-9]|[9][0-2]) logout_user ;;                # 83–92: 10% logout
    93|94) bad_login_user ;;                             # 93–94: 2% wrong logins (max 2/min)
    *) get_menu ;;                                     # 95–99: 5% more menu
  esac
}

while true; do
  random_action
  maybe_extra_menu
  sleep "${SLEEP_SECONDS}"
done
