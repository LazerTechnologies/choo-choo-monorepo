// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";

contract SetData is Script {
    function setMainImage() public {
        string memory mainImage = vm.readFile("base64/mainImage.txt");
        vm.startBroadcast();
        ChooChooTrain(vm.envAddress("SEPOLIA_TRAIN_ADDRESS")).setMainImage(mainImage);
        vm.stopBroadcast();
    }

    function setMainTokenURI() public {
        string memory mainTokenURI = vm.readFile("base64/mainTokenURI.txt");
        vm.startBroadcast();
        ChooChooTrain(vm.envAddress("SEPOLIA_TRAIN_ADDRESS")).setMainTokenURI(mainTokenURI);
        vm.stopBroadcast();
    }

    function setTrainWhistle() public {
        string memory whistle = vm.readFile("base64/trainWhistle.txt");
        vm.startBroadcast();
        ChooChooTrain(vm.envAddress("SEPOLIA_TRAIN_ADDRESS")).setTrainWhistle(whistle);
        vm.stopBroadcast();
    }

    function setImageAndTokenURI() public {
        string memory mainImage = vm.readFile("base64/mainImage.txt");
        string memory mainTokenURI = vm.readFile("base64/mainTokenURI.txt");
        vm.startBroadcast();
        ChooChooTrain train = ChooChooTrain(vm.envAddress("SEPOLIA_TRAIN_ADDRESS"));
        train.setMainImage(mainImage);
        train.setMainTokenURI(mainTokenURI);
        vm.stopBroadcast();
    }

    function setAll() public {
        string memory mainImage = vm.readFile("base64/mainImage.txt");
        string memory mainTokenURI = vm.readFile("base64/mainTokenURI.txt");
        string memory whistle = vm.readFile("base64/trainWhistle.txt");
        vm.startBroadcast();
        ChooChooTrain train = ChooChooTrain(vm.envAddress("SEPOLIA_TRAIN_ADDRESS"));
        train.setMainImage(mainImage);
        train.setMainTokenURI(mainTokenURI);
        train.setTrainWhistle(whistle);
        vm.stopBroadcast();
    }
}
