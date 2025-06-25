// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

// dry run: forge script script/ChooChooTrain.s.sol:ChooChooTrainDeploy --fork-url $BASE_SEPOLIA_RPC_URL -vvvv
// broadcast: forge script script/ChooChooTrain.s.sol:ChooChooTrainDeploy --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify -vvvv
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
