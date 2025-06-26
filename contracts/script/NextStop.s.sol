// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract NextStopScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        address nextPassenger = 0xef00A763368C98C361a9a30cE44D24c8Fed43844;

        vm.startBroadcast(deployerPrivateKey);
        ChooChooTrain(trainAddress).nextStop(nextPassenger);
        vm.stopBroadcast();
    }
}
