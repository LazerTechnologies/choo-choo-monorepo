// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";

contract ChooChooTrainTest is Test {
    ChooChooTrain train;
    address owner = address(0x420);
    address admin1 = address(0x111);
    address admin2 = address(0x222);
    address passenger1 = address(0x001);
    address passenger2 = address(0x002);
    address passenger3 = address(0x003);
    address passenger4 = address(0x004);
    address dead = 0x000000000000000000000000000000000000dEaD;

    event TrainDeparted(address indexed from, address indexed to, uint256 timestamp);
    event TicketStamped(address indexed to, uint256 indexed tokenId, string traits);
    event Yoink(address indexed by, address indexed to, uint256 timestamp);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    function setUp() public {
        vm.prank(owner);
        train = new ChooChooTrain(address(0));
    }

    function testInitialState() public view {
        assertEq(train.ownerOf(0), owner);
        assertEq(train.balanceOf(owner), 1);
        assertEq(train.trainJourney(0), owner);
        assertTrue(train.hasBeenPassenger(owner));
    }

    function testNextStopTransfersTrainAndStampsTicket() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        assertEq(train.ownerOf(0), passenger1);
        assertEq(train.balanceOf(owner), 1); // owner has ticket
        assertEq(train.trainJourney(1), passenger1);
        assertTrue(train.hasBeenPassenger(passenger1));
        // Ticket NFT for owner (but no metadata yet)
        assertEq(train.ownerOf(1), owner);

        // Check that ticket has no metadata initially
        (string memory tUri, string memory tImg, string memory tTraits) = train.ticketData(1);
        assertEq(tUri, "");
        assertEq(tImg, "");
        assertEq(tTraits, "");
    }

    function testCannotSendToSelf() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("CannotSendToCurrentPassenger(address)", owner));
        train.nextStop(owner);
    }

    function testCannotSendToZeroOrDead() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("TransferToInvalidAddress(address)", address(0)));
        train.nextStop(address(0));
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("TransferToInvalidAddress(address)", dead));
        train.nextStop(dead);
    }

    function testCannotRideTrainTwice() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        vm.prank(passenger1);
        train.nextStop(passenger2);
        vm.prank(passenger2);
        train.nextStop(passenger3);
        // passenger1 tries to get train again
        vm.prank(passenger3);
        vm.expectRevert(abi.encodeWithSignature("AlreadyRodeTrain(address)", passenger1));
        train.nextStop(passenger1);
    }

    function testOnlyOwnerOrApprovedCanNextStop() public {
        vm.prank(passenger1);
        vm.expectRevert(abi.encodeWithSignature("NotOwnerNorApproved(address,uint256)", passenger1, 0));
        train.nextStop(passenger2);
    }

    function testOwnerMintTicket() public {
        string memory uri = "ipfs://QmMetaHash";
        string memory img = "ipfs://QmImageHash";
        string memory traits = "ipfs://QmTraitsHash";
        vm.prank(owner);
        train.ownerMintTicket(passenger1, uri, img, traits);
        assertEq(train.ownerOf(1), passenger1);
        (string memory tUri, string memory tImg, string memory tTraits) = train.ticketData(1);
        assertEq(tUri, uri);
        assertEq(tImg, img);
        assertEq(tTraits, traits);
    }

    function testSetMainImageAndTokenURIAndWhistle() public {
        string memory img = "img";
        string memory uri = "uri";
        string memory whistle = "whistle";
        vm.prank(owner);
        train.setMainImage(img);
        vm.prank(owner);
        train.setMainTokenURI(uri);
        vm.prank(owner);
        train.setTrainWhistle(whistle);
        assertEq(train.mainImage(), img);
        assertEq(train.mainTokenURI(), uri);
        assertEq(train.trainWhistle(), whistle);
        assertEq(train.getTrainWhistle(), whistle);
    }

    function testOnlyOwnerCanSetMainImage() public {
        vm.prank(passenger1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", passenger1));
        train.setMainImage("img");
    }

    function testYoinkEligibilityAndAction() public {
        // Move train to passenger1
        vm.prank(owner);
        train.nextStop(passenger1);
        // Move train to passenger2
        vm.prank(passenger1);
        train.nextStop(passenger2);
        // Fast forward <2 days: no yoink
        vm.warp(block.timestamp + 1 days);
        vm.prank(passenger1);
        (bool canYoink, string memory reason) = train.isYoinkable(passenger1);
        assertFalse(canYoink);
        assertEq(reason, "Yoink not available yet");
        // Fast forward to 2 days: only last passenger can yoink
        vm.warp(block.timestamp + 1 days);
        (canYoink, reason) = train.isYoinkable(passenger1);
        assertTrue(canYoink);
        assertEq(reason, "Last passenger can yoink");
        // passenger1 yoinks
        vm.prank(passenger1);
        train.yoink(passenger3);
        assertEq(train.ownerOf(0), passenger3);
        assertTrue(train.hasBeenPassenger(passenger3));
        // Fast forward to 3 days: any previous passenger can yoink
        vm.prank(passenger3);
        train.nextStop(passenger4);
        assertTrue(train.hasBeenPassenger(passenger4));

        vm.warp(block.timestamp + 3 days);
        (canYoink, reason) = train.isYoinkable(passenger1);
        assertTrue(canYoink);
        assertEq(reason, "Any previous passenger can yoink");
    }

    function testYoinkRevertsIfNotEligible() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        vm.prank(passenger1);
        train.nextStop(passenger2);
        // Not enough time passed
        vm.prank(passenger1);
        vm.expectRevert();
        train.yoink(passenger3);
    }

    function testYoinkCannotSendToSelf() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        vm.prank(passenger1);
        train.nextStop(passenger2);
        vm.warp(block.timestamp + 2 days);
        vm.prank(passenger1);
        vm.expectRevert(abi.encodeWithSignature("CannotSendToCurrentPassenger(address)", passenger2));
        train.yoink(passenger2);
    }

    function testEventsEmitted() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit TrainDeparted(owner, passenger1, block.timestamp);
        train.nextStop(passenger1);
        vm.prank(passenger1);
        vm.expectEmit(true, true, false, true);
        emit TrainDeparted(passenger1, passenger2, block.timestamp);
        train.nextStop(passenger2);
    }

    function testWithdrawERC20() public {
        MockERC20 mock = new MockERC20();
        mock.mint(address(train), 1000 ether);
        assertEq(mock.balanceOf(address(train)), 1000 ether);
        vm.prank(passenger1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", passenger1));
        train.withdrawERC20(address(mock));
        uint256 ownerBalanceBefore = mock.balanceOf(owner);
        vm.prank(owner);
        train.withdrawERC20(address(mock));
        assertEq(mock.balanceOf(address(train)), 0);
        assertEq(mock.balanceOf(owner), ownerBalanceBefore + 1000 ether);
        vm.prank(owner);
        vm.expectRevert(bytes("No ERC20 tokens to withdraw"));
        train.withdrawERC20(address(mock));
    }

    function testOwnerIsInitialAdmin() public view {
        address[] memory adminList = train.getAdmins();
        assertEq(adminList.length, 1);
        assertEq(adminList[0], owner);
        assertTrue(train.hasRole(train.ADMIN_ROLE(), owner));
    }

    function testAddAdmin() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit AdminAdded(admin1);
        train.addAdmin(admin1);

        assertTrue(train.hasRole(train.ADMIN_ROLE(), admin1));
        address[] memory adminList = train.getAdmins();
        assertEq(adminList.length, 2);
        assertEq(adminList[1], admin1);
    }

    function testRemoveAdmin() public {
        // Add admin first
        vm.prank(owner);
        train.addAdmin(admin1);

        // Remove admin
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit AdminRemoved(admin1);
        train.removeAdmin(admin1);

        assertFalse(train.hasRole(train.ADMIN_ROLE(), admin1));
        address[] memory adminList = train.getAdmins();
        assertEq(adminList.length, 1);
        assertEq(adminList[0], owner);
    }

    function testOnlyOwnerCanAddRemoveAdmins() public {
        vm.prank(passenger1);
        vm.expectRevert();
        train.addAdmin(admin1);

        vm.prank(owner);
        train.addAdmin(admin1);

        vm.prank(passenger1);
        vm.expectRevert();
        train.removeAdmin(admin1);
    }

    function testCannotAddExistingAdmin() public {
        vm.prank(owner);
        train.addAdmin(admin1);

        vm.prank(owner);
        vm.expectRevert(bytes("Already an admin"));
        train.addAdmin(admin1);
    }

    function testCannotRemoveNonAdmin() public {
        vm.prank(owner);
        vm.expectRevert(bytes("Not an admin"));
        train.removeAdmin(admin1);
    }

    function testSetTicketDataByAdmin() public {
        // First create a ticket by moving the train
        vm.prank(owner);
        train.nextStop(passenger1);

        // Admin sets ticket metadata
        string memory uri = "ipfs://QmMetaHash";
        string memory img = "ipfs://QmImageHash";
        string memory traits = "ipfs://QmTraitsHash";

        vm.prank(owner); // owner is admin
        train.setTicketData(1, uri, img, traits);

        (string memory tUri, string memory tImg, string memory tTraits) = train.ticketData(1);
        assertEq(tUri, uri);
        assertEq(tImg, img);
        assertEq(tTraits, traits);
    }

    function testSetTicketDataByAddedAdmin() public {
        // Add a new admin
        vm.prank(owner);
        train.addAdmin(admin1);

        // Create a ticket
        vm.prank(owner);
        train.nextStop(passenger1);

        // New admin sets ticket metadata
        string memory uri = "ipfs://QmMetaHash";
        string memory img = "ipfs://QmImageHash";
        string memory traits = "ipfs://QmTraitsHash";

        vm.prank(admin1);
        train.setTicketData(1, uri, img, traits);

        (string memory tUri, string memory tImg, string memory tTraits) = train.ticketData(1);
        assertEq(tUri, uri);
        assertEq(tImg, img);
        assertEq(tTraits, traits);
    }

    function testOnlyAdminCanSetTicketData() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        // sorry normie
        vm.prank(passenger1);
        vm.expectRevert(bytes("Not an admin"));
        train.setTicketData(1, "ipfs://test", "ipfs://img", "ipfs://traits");
    }

    function testCannotSetTicketDataForTrainNFT() public {
        vm.prank(owner);
        vm.expectRevert(bytes("Cannot update train NFT"));
        train.setTicketData(0, "ipfs://test", "ipfs://img", "ipfs://traits");
    }

    function testCannotSetTicketDataForNonExistentToken() public {
        vm.prank(owner);
        vm.expectRevert(bytes("Token does not exist"));
        train.setTicketData(999, "ipfs://test", "ipfs://img", "ipfs://traits");
    }
}
