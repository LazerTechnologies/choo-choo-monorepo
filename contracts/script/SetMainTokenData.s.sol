// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract SetMainTokenData is Script {
    // IPFS URIs - update these values as needed
    string constant MAIN_IMAGE = "ipfs://QmNQJCBYV2kbqsdZmoCsUQV4Lh6yUqLwMJ3SV1x9ozUo72";
    string constant MAIN_TOKEN_URI = "ipfs://QmW9UvMToz38ykgzpFpYWCvQ5hdEqVsZwgLu8tW1Y8vuo1";

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("MAINNET_TRAIN_ADDRESS");

        console2.log("Setting main token data for train at:", trainAddress);
        console2.log("New main image:", MAIN_IMAGE);
        console2.log("New main token URI:", MAIN_TOKEN_URI);

        vm.startBroadcast(deployerPrivateKey);

        ChooChooTrain train = ChooChooTrain(trainAddress);

        // Set the main image (IPFS URL to the image)
        train.setMainImage(MAIN_IMAGE);
        console2.log("Main image updated successfully");

        // Set the main token URI (IPFS URL to the metadata JSON)
        train.setMainTokenURI(MAIN_TOKEN_URI);
        console2.log("Main token URI updated successfully");

        vm.stopBroadcast();

        console2.log("Main token data (tokenId=0) updated successfully!");
    }

    function setImageOnly() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("MAINNET_TRAIN_ADDRESS");

        console2.log("Setting main image for train at:", trainAddress);
        console2.log("New main image:", MAIN_IMAGE);

        vm.startBroadcast(deployerPrivateKey);
        ChooChooTrain(trainAddress).setMainImage(MAIN_IMAGE);
        vm.stopBroadcast();

        console2.log("Main image updated successfully!");
    }

    function setTokenURIOnly() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("MAINNET_TRAIN_ADDRESS");

        console2.log("Setting main token URI for train at:", trainAddress);
        console2.log("New main token URI:", MAIN_TOKEN_URI);

        vm.startBroadcast(deployerPrivateKey);
        ChooChooTrain(trainAddress).setMainTokenURI(MAIN_TOKEN_URI);
        vm.stopBroadcast();

        console2.log("Main token URI updated successfully!");
    }
}
