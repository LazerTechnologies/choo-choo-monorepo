// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

// Interface approach to avoid compilation issues
interface IChooChooTrain {
    function addAdmin(address[] calldata newAdmins) external;
    function removeAdmin(address admin) external;
    function getAdmins() external view returns (address[] memory);
}

contract AdminManager is Script {
    address jon = 0xef00A763368C98C361a9a30cE44D24c8Fed43844;
    address garrett = 0x45db9d3457c2Cb05C4BFc7334a33ceE6e19d508F;
    address yon = 0xa27F2B7517Bf1b7AC741E116Fe1db373D590205F;

    address[] adminsToAdd = [jon, garrett, yon];
    address[] adminsToRemove = [jon, garrett, yon];

    // forge script script/AdminManager.s.sol:addAdmin --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY -vvvv
    function addAdmin() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("MAINNET_TRAIN_ADDRESS");
        vm.startBroadcast(deployerPrivateKey);
        IChooChooTrain(trainAddress).addAdmin(adminsToAdd);
        vm.stopBroadcast();
    }

    // forge script script/AdminManager.s.sol:removeAdmin --rpc-url $BASE_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
    function removeAdmin() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("MAINNET_TRAIN_ADDRESS");
        vm.startBroadcast(deployerPrivateKey);
        for (uint256 i = 0; i < adminsToRemove.length; i++) {
            IChooChooTrain(trainAddress).removeAdmin(adminsToRemove[i]);
        }
        vm.stopBroadcast();
    }

    // forge script script/AdminManager.s.sol:listAdmins --rpc-url $BASE_RPC_URL
    function listAdmins() public view returns (address[] memory) {
        address trainAddress = vm.envAddress("MAINNET_TRAIN_ADDRESS");
        address[] memory admins = IChooChooTrain(trainAddress).getAdmins();
        for (uint256 i = 0; i < admins.length; i++) {
            console2.log("Admin", i, admins[i]);
        }
        return admins;
    }
}
