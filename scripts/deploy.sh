#!/bin/bash
source .env

# Interactive script to deploy the ChooChooTrain contract

# --- Configuration ---
CONTRACT_SCRIPT_PATH="contracts/script/ChooChooTrain.s.sol:ChooChooTrainDeploy"
CONTRACT_FILE_PATH="contracts/src/ChooChooTrain.sol:ChooChooTrain"
TESTNET_RPC_URL="https://sepolia.base.org"
MAINNET_RPC_URL="https://go.getblock.io/a44e913c0ea5459890f97fa61906ac5b"
VERIFIER_URL="https://base-sepolia.blockscout.com/api/"
APP_ABI_PATH="app/src/abi/ChooChooTrain.abi.json"
BUILT_ABI_PATH="contracts/out/ChooChooTrain.sol/ChooChooTrain.json"

# --- Functions ---

# Function to display messages
function msg {
  echo -e "\n\033[1;32m$1\033[0m\n"
}

# Function to display errors
function error_msg {
  echo -e "\n\033[1;31mError: $1\033[0m\n"
  exit 1
}

# Function to check and update ABI
function check_and_update_abi {
    msg "Building contracts and checking ABI..."
    (cd contracts && forge build)

    # Extract the 'abi' key from both JSON files and compare them
    local built_abi=$(jq '.abi' "$BUILT_ABI_PATH")
    local app_abi=$(cat "$APP_ABI_PATH")

    if [ "$(echo $built_abi | jq -S .)" != "$(echo $app_abi | jq -S .)" ]; then
        read -p "App ABI is out of date, would you like to update it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            msg "Updating app ABI..."
            if ! node scripts/extract-abi.js; then
                error_msg "Failed to update ABI."
            fi
            msg "App ABI updated successfully."
        fi
    else
        msg "App ABI is up to date."
    fi
}

# Function to deploy the contract
function deploy_contract {
  local network_name=$1
  local rpc_url=$2

  msg "Deploying ChooChooTrain to $network_name..."

  local cmd_args=()
  cmd_args+=("$CONTRACT_SCRIPT_PATH" --rpc-url "$rpc_url" --broadcast)

  if [[ "$network_name" == "base" ]]; then
    cmd_args+=("--verify")
  fi

  cmd_args+=("-vvvv")

  # Run the deployment command and capture the output
  local deploy_output
  if ! deploy_output=$(forge script "${cmd_args[@]}"); then
    error_msg "Deployment failed. See output above for details."
  fi

  # Extract the contract address
  CONTRACT_ADDRESS=$(echo "$deploy_output" | grep "Contract Address" | awk '{print $3}')

  if [ -z "$CONTRACT_ADDRESS" ]; then
    error_msg "Could not extract the contract address from the deployment output."
  fi

  msg "Successfully deployed! Contract Address: $CONTRACT_ADDRESS"
}

# Function to verify the contract on Sepolia
function verify_on_sepolia {
  msg "Verifying contract on Sepolia..."

  if ! (cd contracts && forge verify-contract --rpc-url https://sepolia-preconf.base.org --verifier blockscout --verifier-url "$VERIFIER_URL" "$CONTRACT_ADDRESS" "$CONTRACT_FILE_PATH"); then
    error_msg "Verification failed. See output above for details."
  fi

  msg "Contract verified successfully!"
}


# --- Main Script ---

# Check for required environment variables
if [ -z "$BASE_SEPOLIA_RPC_URL" ] || [ -z "$BASE_RPC_URL" ]; then
  error_msg "BASE_SEPOLIA_RPC_URL and BASE_RPC_URL environment variables must be set."
fi

check_and_update_abi

# Prompt user for network choice
echo "Choose a network to deploy to:"
select network in "base-sepolia" "base"; do
  case $network in
    base-sepolia)
      deploy_contract "base-sepolia" "$TESTNET_RPC_URL"
      verify_on_sepolia
      break
      ;;
    base)
      deploy_contract "base" "$MAINNET_RPC_URL"
      # Mainnet verification is handled automatically by the deploy script with --verify flag
      break
      ;;
    *)
      echo "Invalid option. Please choose either 1 (base-sepolia) or 2 (base)."
      ;;
  esac
done
