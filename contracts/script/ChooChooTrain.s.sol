// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract ChooChooTrainDeploy is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ChooChooTrain train = new ChooChooTrain();
        console2.log("ChooChooTrain deployed at:", address(train));

        vm.stopBroadcast();
    }
}
