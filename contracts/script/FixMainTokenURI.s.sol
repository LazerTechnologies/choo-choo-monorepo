// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

// Interface to avoid compilation issues
interface IChooChooTrain {
    function setMainTokenURI(string memory uri) external;
    function mainTokenURI() external view returns (string memory);
}

contract FixMainTokenURI is Script {
    // The correct metadata hash (not the image hash)
    string constant CORRECT_METADATA_URI = "ipfs://bafkreihj4ph4csbqmc7zcyjmou4qftbr37vboekgjnvld7gqjdqkll6lba";

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address trainAddress = vm.envAddress("SEPOLIA_TRAIN_ADDRESS");

        console2.log("=== Fixing MainTokenURI ===");
        console2.log("Train Address:", trainAddress);
        console2.log("Target URI:", CORRECT_METADATA_URI);

        // Check current URI before fixing
        string memory currentURI = IChooChooTrain(trainAddress).mainTokenURI();
        console2.log("Current URI:", currentURI);

        vm.startBroadcast(deployerPrivateKey);

        // Set the correct metadata URI
        IChooChooTrain(trainAddress).setMainTokenURI(CORRECT_METADATA_URI);

        vm.stopBroadcast();

        console2.log("MainTokenURI updated successfully!");
        console2.log("The train (tokenId 0) should now display correctly on block explorers");
    }
}
