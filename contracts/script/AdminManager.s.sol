// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

// Interface approach to avoid compilation issues
interface IChooChooTrain {
    function addAdmin(address admin) external;
    function removeAdmin(address admin) external;
    function getAdmins() external view returns (address[] memory);
}

contract AdminManager is Script {
    address jon = 0xef00A763368C98C361a9a30cE44D24c8Fed43844;
    address garrett = 0x0000000000000000000000000000000000000001;
    address yon = 0x0000000000000000000000000000000000000002;

    address[] adminsToAdd = [jon];
    address[] adminsToRemove = [jon];

    // forge script script/AdminManager.s.sol:addAdmin --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY -vvvv
    function addAdmin() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        vm.startBroadcast(deployerPrivateKey);
        for (uint256 i = 0; i < adminsToAdd.length; i++) {
            IChooChooTrain(trainAddress).addAdmin(adminsToAdd[i]);
        }
        vm.stopBroadcast();
    }

    // forge script script/AdminManager.s.sol:removeAdmin --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
    function removeAdmin() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        vm.startBroadcast(deployerPrivateKey);
        for (uint256 i = 0; i < adminsToRemove.length; i++) {
            IChooChooTrain(trainAddress).removeAdmin(adminsToRemove[i]);
        }
        vm.stopBroadcast();
    }

    // forge script script/AdminManager.s.sol:listAdmins --rpc-url $BASE_SEPOLIA_RPC_URL
    function listAdmins() public view returns (address[] memory) {
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");
        address[] memory admins = IChooChooTrain(trainAddress).getAdmins();
        for (uint256 i = 0; i < admins.length; i++) {
            console2.log("Admin", i, admins[i]);
        }
        return admins;
    }
}
