// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract YoinkScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        address to = 0x799db599931027e5A409501e09e908eb30441BAB;

        vm.startBroadcast(deployerPrivateKey);
        ChooChooTrain(trainAddress).yoink(to);
        vm.stopBroadcast();
    }
}
