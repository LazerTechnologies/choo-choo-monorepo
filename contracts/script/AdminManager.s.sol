// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract AdminManager is Script {
    address jon = 0xef00A763368C98C361a9a30cE44D24c8Fed43844;
    address garrett = 0x0000000000000000000000000000000000000001;
    address yon = 0x0000000000000000000000000000000000000002;

    address[] adminsToAdd = [jon, garrett, yon];
    address[] adminsToRemove = [jon, garrett, yon];

    // forge script contracts/script/AdminManager.s.sol:addAdmin --fork-url $RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
    function addAdmin() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        vm.startBroadcast(deployerPrivateKey);
        for (uint256 i = 0; i < adminsToAdd.length; i++) {
            ChooChooTrain(trainAddress).addAdmin(adminsToAdd[i]);
        }
        vm.stopBroadcast();
    }

    // forge script contracts/script/AdminManager.s.sol:removeAdmin --fork-url $RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
    function removeAdmin() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        vm.startBroadcast(deployerPrivateKey);
        for (uint256 i = 0; i < adminsToRemove.length; i++) {
            ChooChooTrain(trainAddress).removeAdmin(adminsToRemove[i]);
        }
        vm.stopBroadcast();
    }

    // forge script contracts/script/AdminManager.s.sol:listAdmins --fork-url $RPC_URL
    function listAdmins() public view returns (address[] memory) {
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        address[] memory admins = ChooChooTrain(trainAddress).getAdmins();
        for (uint256 i = 0; i < admins.length; i++) {
            console2.log("Admin", i, admins[i]);
        }
        return admins;
    }
}
