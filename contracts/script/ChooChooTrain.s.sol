// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract ChooChooTrainDeploy is Script {
    // jonbray.eth
    address initialHolder = 0xef00A763368C98C361a9a30cE44D24c8Fed43844;

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ChooChooTrain train = new ChooChooTrain(initialHolder);
        console2.log("ChooChooTrain deployed at:", address(train));
        console2.log("Initial holder set to:", initialHolder);
        console2.log("USDC address initialized to:", train.usdc());
        console2.log("Required deposit cost:", train.depositCost());

        vm.stopBroadcast();
    }
}
