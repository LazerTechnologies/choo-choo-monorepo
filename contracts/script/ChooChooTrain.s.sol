// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract ChooChooTrainDeploy is Script {
    // @todo: set to CB paymaster
    address paymasterForwarder = 0x0000000000000000000000000000000000000000;
    // jon primary
    address initialHolder = 0xe80bAf30193f068822E8F327E17371a49b7EEeB9;

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ChooChooTrain train = new ChooChooTrain(paymasterForwarder, initialHolder);
        console2.log("ChooChooTrain deployed at:", address(train));
        console2.log("Initial holder set to:", initialHolder);
        console2.log("USDC address initialized to:", train.usdc());
        console2.log("Required deposit cost:", train.getRequiredDeposit());

        vm.stopBroadcast();
    }
}
