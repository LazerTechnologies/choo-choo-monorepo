#!/bin/bash
# utility script to extract the ChooChooTrain abi into the app/abi directory
# run this from the root of the project
# bash extract-abi.sh

set -e

# Build contracts
cd contracts
forge build
cd ..

# Ensure output directory exists
mkdir -p app/abi

# Extract ABI using jq
jq .abi contracts/out/ChooChooTrain.sol/ChooChooTrain.json > app/src/abi/ChooChooTrain.abi.json

echo "ABI extracted to app/src/abi/ChooChooTrain.abi.json" 