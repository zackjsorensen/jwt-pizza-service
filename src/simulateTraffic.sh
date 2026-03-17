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

# In-memory tokens per email after login/registration
declare -A TOKENS

USER_PASSWORD="pizzapw"

random_index() {
  local max="$1"
  echo $((RANDOM % max))
}

random_name() {
  # cheap random name; uniqueness is not critical
  echo "user$RANDOM$RANDOM"
}

random_email() {
  echo "$(random_name)@test.com"
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

  # Try to grab token if registration succeeded
  if jq -e '.token' /tmp/reg.json >/dev/null 2>&1; then
    local token
    token=$(jq -r '.token' /tmp/reg.json)
    TOKENS["$email"]="$token"
    echo "Registered and stored token for $email"
  fi
}

login_user() {
  # pick a random email we may or may not have registered yet
  local email
  # Reuse an existing user about half the time if we have any tokens
  if (( RANDOM % 2 == 0 )) && ((${#TOKENS[@]} > 0)); then
    # Reuse a known user ~50% of the time
    local email_list=()
    for e in "${!TOKENS[@]}"; do
      email_list+=("$e")
    done
    local count=${#email_list[@]}
    local idx
    idx=$(random_index "$count")
    email="${email_list[$idx]}"
  else
    # Otherwise potentially log in a never-registered user (should fail)
    email=$(random_email)
  fi

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
  # Always attempt with wrong password to generate failed auth metrics
  local email
  email=$(random_email)

  echo ""
  echo "==> BAD login attempt for: $email"
  curl -s -o /tmp/login_bad.json -w " HTTP_%{http_code}\n" \
    -X PUT "${BASE_URL}/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"wrongpw\"}"
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

  # Simple random order: 1–25 items with small random prices
  local items_json='[]'
  # About 20% of orders will be 20+ pizzas to trigger factory failures.
  local item_count
  if (( RANDOM % 5 == 0 )); then
    item_count=$((20 + RANDOM % 10))  # 20–29
    echo "==> Creating LARGE order (likely to fail) with ${item_count} pizzas"
  else
    item_count=$((1 + RANDOM % 3))    # 1–3
  fi
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
  # One HTTP request per loop => with default 2s sleep ~30 requests/min (<60).
  case $((RANDOM % 8)) in
    0) register_user ;;     # successful (or duplicate) registrations
    1) login_user ;;        # mix of success/failure
    2) bad_login_user ;;    # explicit failed auth
    3) create_order ;;      # includes some large failing orders
    4) logout_user ;;       # successful logouts
    5) get_menu ;;          # anonymous GET
    6) create_order ;;      # bias slightly toward orders
    7) login_user ;;        # more logins
  esac
}

while true; do
  random_action
  sleep "${SLEEP_SECONDS}"
done