#!/usr/bin/env bash

# Simple traffic simulator for JWT Pizza service.
# Generates a mix of:
# - user registrations
# - logins
# - order creations
# - logouts
#
# Usage:
#   ./simulateTraffic.sh [base_url] [sleep_seconds]
# Example:
#   ./simulateTraffic.sh http://localhost:3000 2

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
SLEEP_SECONDS="${2:-2}"

echo "Simulating traffic against ${BASE_URL} every ${SLEEP_SECONDS}s"
echo "Press Ctrl+C to stop."

# In-memory "users" we will cycle through
USER_NAMES=("Alice" "Bob" "Carol" "Dave" "Eve")
USER_EMAILS=("alice@example.com" "bob@example.com" "carol@example.com" "dave@example.com" "eve@example.com")
USER_PASSWORD="pizzapw"

# We cache tokens per email after login/registration
declare -A TOKENS

random_index() {
  local max="$1"
  echo $((RANDOM % max))
}

register_user() {
  local idx
  idx=$(random_index ${#USER_NAMES[@]})
  local name="${USER_NAMES[$idx]}"
  local email="${USER_EMAILS[$idx]}"

  echo ""
  echo "==> Registering user: $name <$email>"
  curl -s -o /tmp/reg.json -w " HTTP_%{http_code}\n" \
    -X POST "${BASE_URL}/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\",\"email\":\"${email}\",\"password\":\"${USER_PASSWORD}\"}"

  # Try to grab token if registration succeeded
  if jq -e '.token' /tmp/reg.json >/dev/null 2>&1; then
    local token
    token=$(jq -r '.token' /tmp/reg.json)
    TOKENS["$email"]="$token"
    echo "Registered and stored token for $email"
  fi
}

login_user() {
  local idx
  idx=$(random_index ${#USER_EMAILS[@]})
  local email="${USER_EMAILS[$idx]}"

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

logout_user() {
  # pick a random user that has a token
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

  # On any attempt, forget the token so we don't treat them as active
  unset TOKENS["$email"]
}

get_menu() {
  echo ""
  echo "==> Getting menu"
  curl -s -o /tmp/menu.json -w " HTTP_%{http_code}\n" \
    "${BASE_URL}/api/order/menu"
}

create_order() {
  # Need a logged-in user
  local email_list=()
  for e in "${!TOKENS[@]}"; do
    email_list+=("$e")
  done
  local count=${#email_list[@]}
  if (( count == 0 )); then
    echo ""
    echo "==> No logged-in users to create order; trying a login instead."
    login_user
    return
  fi

  local idx
  idx=$(random_index "$count")
  local email="${email_list[$idx]}"
  local token="${TOKENS[$email]}"

  # Simple random order: 1–3 items with small random prices
  local items_json='[]'
  local item_count=$((1 + RANDOM % 3))
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
  echo "Body: $order_body"
  curl -s -o /tmp/order.json -w " HTTP_%{http_code}\n" \
    -X POST "${BASE_URL}/api/order" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${token}" \
    -d "$order_body"
}

random_action() {
  case $((RANDOM % 6)) in
    0) register_user ;;
    1) login_user ;;
    2) create_order ;;
    3) logout_user ;;
    4) get_menu ;;
    5) create_order ;;  # bias slightly toward orders
  esac
}

while true; do
  random_action
  sleep "${SLEEP_SECONDS}"
done