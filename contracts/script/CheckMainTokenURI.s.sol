// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

// Interface to check contract state
interface IChooChooTrain {
    function mainTokenURI() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract CheckMainTokenURI is Script {
    function run() public view {
        address trainAddress = vm.envAddress("MAINNET_TRAIN_ADDRESS");

        console2.log("=== Contract State Check ===");
        console2.log("Train Address:", trainAddress);

        IChooChooTrain train = IChooChooTrain(trainAddress);

        // Check mainTokenURI
        string memory mainURI = train.mainTokenURI();
        console2.log("mainTokenURI():", mainURI);

        // Check tokenURI(0)
        string memory token0URI = train.tokenURI(0);
        console2.log("tokenURI(0):", token0URI);

        // Check if they match
        console2.log("URIs match:", keccak256(bytes(mainURI)) == keccak256(bytes(token0URI)));

        // Check owner of token 0
        address owner = train.ownerOf(0);
        console2.log("Current train holder:", owner);

        // Expected metadata URI
        string memory expectedURI = "ipfs://bafkreih4woyxv6x4ypigqbvqxlugm5bz7qk4wh2sae7kse4horx2nknli4";
        console2.log("Expected URI:", expectedURI);
        console2.log("Is correct URI:", keccak256(bytes(mainURI)) == keccak256(bytes(expectedURI)));
    }
}
