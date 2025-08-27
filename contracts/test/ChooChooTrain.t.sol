// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ChooChooTrain} from "../src/ChooChooTrain.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";

contract ChooChooTrainTest is Test {
    ChooChooTrain train;
    MockUSDC usdc;
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
    event UsdcDeposited(address indexed from, uint256 indexed fid, uint256 amount);
    event UsdcWithdrawn(address indexed to, address indexed token, uint256 amount);
    event UsdcAddressUpdated(address indexed previous, address indexed current);
    event DepositCostUpdated(uint256 previous, uint256 current);

    function setUp() public {
        vm.prank(owner);
        train = new ChooChooTrain(address(0), owner);
        usdc = new MockUSDC();

        vm.prank(owner);
        train.setUsdc(address(usdc));
    }

    function testInitialState() public view {
        assertEq(train.ownerOf(0), owner);
        assertEq(train.balanceOf(owner), 1);
        assertFalse(train.hasBeenPassenger(owner));
        assertEq(train.getTrainJourneyLength(), 0);
    }

    function testNextStopTransfersTrainAndStampsTicket() public {
        vm.prank(owner); // owner is admin by default
        train.nextStop(passenger1);
        assertEq(train.ownerOf(0), passenger1);
        assertEq(train.balanceOf(owner), 1); // owner should have ticket
        assertEq(train.trainJourney(0), owner);
        assertEq(train.getTrainJourneyLength(), 1);
        assertTrue(train.hasBeenPassenger(owner));
        assertFalse(train.hasBeenPassenger(passenger1));
        assertEq(train.ownerOf(1), owner);
        (string memory tUri, string memory tImg, string memory tTraits) = train.ticketData(1);
        assertEq(tUri, "");
        assertEq(tImg, "");
        assertEq(tTraits, "");
    }

    function testOnlyAdminCanMoveTrainNextStop() public {
        // Non-admin cannot move train
        vm.prank(passenger1);
        vm.expectRevert(bytes("Not an admin"));
        train.nextStop(passenger2);

        // Admin can move train
        vm.prank(owner); // owner is admin by default
        train.nextStop(passenger1);
        assertEq(train.ownerOf(0), passenger1);
    }

    function testNextStopWithTicketData() public {
        string memory tokenURI = "ipfs://QmTestMetadata";

        vm.prank(owner); // owner is admin
        train.nextStopWithTicketData(passenger1, tokenURI);

        // Check train moved
        assertEq(train.ownerOf(0), passenger1);
        assertEq(train.trainJourney(0), owner);
        assertEq(train.getTrainJourneyLength(), 1);
        assertTrue(train.hasBeenPassenger(owner));
        assertFalse(train.hasBeenPassenger(passenger1));

        assertEq(train.ownerOf(1), owner);
        (string memory tUri,,) = train.ticketData(1);
        assertEq(tUri, tokenURI);
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
        vm.prank(owner); // only admin can move train
        train.nextStop(passenger2);
        vm.prank(owner); // only admin can move train
        train.nextStop(passenger3);
        // passenger1 tries to get train again
        vm.prank(owner); // only admin can move train
        vm.expectRevert(abi.encodeWithSignature("AlreadyRodeTrain(address)", passenger1));
        train.nextStop(passenger1);
    }

    function testRegularTransfersBlockedForTrainToken() public {
        // Regular transfer/transferFrom should be blocked for token ID 0
        vm.prank(owner);
        vm.expectRevert(bytes("Train can only be moved by admins"));
        train.transferFrom(owner, passenger1, 0);

        vm.prank(owner);
        vm.expectRevert(bytes("Train can only be moved by admins"));
        train.safeTransferFrom(owner, passenger1, 0);
    }

    function testTicketTransfersStillWork() public {
        // Move train to create a ticket
        vm.prank(owner);
        train.nextStop(passenger1);

        // Owner should have ticket ID 1
        assertEq(train.ownerOf(1), owner);

        // Owner can transfer their ticket normally
        vm.prank(owner);
        train.transferFrom(owner, passenger2, 1);
        assertEq(train.ownerOf(1), passenger2);
    }

    function testGetTrainJourneySlice() public {
        // Create some journey history
        vm.prank(owner);
        train.nextStop(passenger1); // owner completes journey
        vm.prank(owner);
        train.nextStop(passenger2); // passenger1 completes journey
        vm.prank(owner);
        train.nextStop(passenger3); // passenger2 completes journey

        // Journey should be: [owner, passenger1, passenger2]
        assertEq(train.getTrainJourneyLength(), 3);

        // Test slice function
        address[] memory slice = train.getTrainJourneySlice(1, 3);
        assertEq(slice.length, 2);
        assertEq(slice[0], passenger1);
        assertEq(slice[1], passenger2);
    }

    function testGetCurrentTrainHolder() public {
        assertEq(train.getCurrentTrainHolder(), owner);

        vm.prank(owner);
        train.nextStop(passenger1);
        assertEq(train.getCurrentTrainHolder(), passenger1);
    }

    function testGetTrainStatus() public {
        (address holder, uint256 totalStops, uint256 lastMoveTime, bool canBeYoinked, uint256 nextTicketId_) =
            train.getTrainStatus();

        assertEq(holder, owner);
        assertEq(totalStops, 0); // no completed journeys yet
        assertTrue(lastMoveTime > 0);
        assertFalse(canBeYoinked); // no time passed yet
        assertEq(nextTicketId_, 1);

        // Move train and check again
        vm.warp(block.timestamp + 3 days);
        vm.prank(owner);
        train.nextStop(passenger1); // owner completes journey

        (holder, totalStops, lastMoveTime, canBeYoinked, nextTicketId_) = train.getTrainStatus();
        assertEq(holder, passenger1);
        assertEq(totalStops, 1); // owner completed their journey
        assertFalse(canBeYoinked); // just moved, so no yoink available yet
        assertEq(nextTicketId_, 2); // next ticket will be ID 2

        // Test that after 48 hours, yoink becomes available
        vm.warp(block.timestamp + 48 hours);
        (,,, canBeYoinked,) = train.getTrainStatus();
        assertTrue(canBeYoinked); // now yoink is available
    }

    function testHasRiddenTrain() public {
        assertFalse(train.hasRiddenTrain(owner)); // owner hasn't completed journey yet
        assertFalse(train.hasRiddenTrain(passenger1));

        vm.prank(owner);
        train.nextStop(passenger1); // owner completes journey
        assertTrue(train.hasRiddenTrain(owner)); // now owner has completed journey
        assertFalse(train.hasRiddenTrain(passenger1)); // passenger1 hasn't completed journey yet
    }

    function testGetTotalTickets() public {
        assertEq(train.getTotalTickets(), 0); // no tickets minted yet

        vm.prank(owner);
        train.nextStop(passenger1);
        assertEq(train.getTotalTickets(), 1); // one ticket minted

        vm.prank(owner);
        train.nextStop(passenger2);
        assertEq(train.getTotalTickets(), 2); // two tickets minted
    }

    function testAddedAdminCanMoveTrainAndSetData() public {
        // Add new admin
        vm.prank(owner);
        train.addAdmin(admin1);

        // New admin can move train
        vm.prank(admin1);
        train.nextStop(passenger1);
        assertEq(train.ownerOf(0), passenger1);

        // New admin can use nextStopWithTicketData
        string memory tokenURI = "ipfs://QmTestMetadata";
        vm.prank(admin1);
        train.nextStopWithTicketData(passenger2, tokenURI);

        assertEq(train.ownerOf(0), passenger2);
        (string memory tUri,,) = train.ticketData(2);
        assertEq(tUri, tokenURI);
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
        vm.prank(owner);
        train.nextStop(passenger1);
        vm.prank(owner); // only admin can move train
        train.nextStop(passenger2);

        // Fast forward < 48 hours: no yoink available
        vm.warp(block.timestamp + 24 hours);
        (bool canYoink, string memory reason) = train.isYoinkable();
        assertFalse(canYoink);
        assertEq(reason, "48 hour cooldown not met");

        // Fast forward to 48 hours: yoink available
        vm.warp(block.timestamp + 24 hours);
        (canYoink, reason) = train.isYoinkable();
        assertTrue(canYoink);
        assertEq(reason, "Train can be yoinked by admin");

        // Only admin can yoink
        vm.prank(passenger1);
        vm.expectRevert(bytes("Not an admin"));
        train.yoink(passenger3);

        // Admin yoinks to passenger3
        vm.prank(owner);
        train.yoink(passenger3);
        assertEq(train.ownerOf(0), passenger3);
        assertTrue(train.hasBeenPassenger(passenger2));
        assertFalse(train.hasBeenPassenger(passenger3));

        // Check that previous holder got a ticket
        assertEq(train.ownerOf(3), passenger2); // passenger2 gets ticket ID 3
    }

    function testYoinkRevertsIfNotEligible() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        vm.prank(owner); // only admin can move train
        train.nextStop(passenger2);

        // Not enough time passed - admin should still get reverted
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("NotEligibleToYoink(string)", "48 hour cooldown not met"));
        train.yoink(passenger3);

        // Non-admin should be reverted even after time passes
        vm.warp(block.timestamp + 48 hours);
        vm.prank(passenger1);
        vm.expectRevert(bytes("Not an admin"));
        train.yoink(passenger3);
    }

    function testYoinkCannotSendToSelf() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        vm.prank(owner); // only admin can move train
        train.nextStop(passenger2);
        vm.warp(block.timestamp + 48 hours);
        vm.prank(owner); // admin trying to yoink
        vm.expectRevert(abi.encodeWithSignature("CannotSendToCurrentPassenger(address)", passenger2));
        train.yoink(passenger2);
    }

    function testYoinkCannotSendToPreviousPassenger() public {
        vm.prank(owner);
        train.nextStop(passenger1);
        vm.prank(owner); // only admin can move train
        train.nextStop(passenger2);
        vm.warp(block.timestamp + 48 hours);

        // Admin cannot yoink to passenger1 who already rode the train
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("AlreadyRodeTrain(address)", passenger1));
        train.yoink(passenger1);

        // Admin cannot yoink to owner who already rode the train
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("AlreadyRodeTrain(address)", owner));
        train.yoink(owner);
    }

    function testAddedAdminCanYoink() public {
        // Add new admin
        vm.prank(owner);
        train.addAdmin(admin1);

        // Move train to passenger1
        vm.prank(owner);
        train.nextStop(passenger1);

        // Wait 48 hours
        vm.warp(block.timestamp + 48 hours);

        // Added admin can yoink
        vm.prank(admin1);
        train.yoink(passenger2);

        assertEq(train.ownerOf(0), passenger2);
        assertTrue(train.hasBeenPassenger(passenger1));
        assertFalse(train.hasBeenPassenger(passenger2));
        assertEq(train.ownerOf(2), passenger1); // passenger1 gets ticket ID 2
    }

    function testEventsEmitted() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit TrainDeparted(owner, passenger1, block.timestamp);
        train.nextStop(passenger1);
        vm.prank(owner); // only admin can move train
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

    function testConstructorValidatesInitialHolder() public {
        // Test zero address rejection
        vm.expectRevert(abi.encodeWithSignature("TransferToInvalidAddress(address)", address(0)));
        new ChooChooTrain(address(0), address(0));

        // Test dead address rejection
        vm.expectRevert(abi.encodeWithSignature("TransferToInvalidAddress(address)", dead));
        new ChooChooTrain(address(0), dead);

        // Test valid address works
        ChooChooTrain validTrain = new ChooChooTrain(address(0), passenger1);
        assertEq(validTrain.ownerOf(0), passenger1);
        // Initial holder is not yet considered a passenger until they complete their journey
        assertFalse(validTrain.hasBeenPassenger(passenger1));
        assertEq(validTrain.getTrainJourneyLength(), 0);
    }

    // ========== USDC DEPOSIT TESTS ========== //

    function testDepositUsdcAtLeastOne() public {
        uint256 fid = 12345;
        uint256 depositCost = train.getRequiredDeposit();

        // Mint USDC to passenger1
        usdc.mint(passenger1, depositCost * 2);

        // Test insufficient deposit reverts
        vm.prank(passenger1);
        usdc.approve(address(train), depositCost - 1);
        vm.prank(passenger1);
        vm.expectRevert(abi.encodeWithSignature("InsufficientDeposit(uint256,uint256)", depositCost - 1, depositCost));
        train.depositUSDC(fid, depositCost - 1);

        // Test sufficient deposit succeeds
        vm.prank(passenger1);
        usdc.approve(address(train), depositCost);
        vm.prank(passenger1);
        train.depositUSDC(fid, depositCost);

        assertEq(train.fidToUsdcDeposited(fid), depositCost);
    }

    function testDepositRecordsByFidAndEmitsEvent() public {
        uint256 fid = 12345;
        uint256 depositAmount = 2 * 10 ** 6; // 2 USDC

        // Mint USDC to passenger1
        usdc.mint(passenger1, depositAmount);

        // Approve and deposit
        vm.prank(passenger1);
        usdc.approve(address(train), depositAmount);

        // Expect event emission
        vm.expectEmit(true, true, false, true);
        emit UsdcDeposited(passenger1, fid, depositAmount);

        vm.prank(passenger1);
        train.depositUSDC(fid, depositAmount);

        // Check mapping updated
        assertEq(train.fidToUsdcDeposited(fid), depositAmount);

        // Check contract received USDC
        assertEq(usdc.balanceOf(address(train)), depositAmount);
    }

    function testAnyUserCanDeposit() public {
        uint256 fid1 = 111;
        uint256 fid2 = 222;
        uint256 depositAmount = 1 * 10 ** 6; // 1 USDC

        // Mint USDC to multiple users
        usdc.mint(passenger1, depositAmount);
        usdc.mint(passenger2, depositAmount);

        // First user deposits
        vm.prank(passenger1);
        usdc.approve(address(train), depositAmount);
        vm.prank(passenger1);
        train.depositUSDC(fid1, depositAmount);

        // Second user deposits
        vm.prank(passenger2);
        usdc.approve(address(train), depositAmount);
        vm.prank(passenger2);
        train.depositUSDC(fid2, depositAmount);

        // Check both deposits recorded
        assertEq(train.fidToUsdcDeposited(fid1), depositAmount);
        assertEq(train.fidToUsdcDeposited(fid2), depositAmount);
        assertEq(usdc.balanceOf(address(train)), depositAmount * 2);
    }

    function testWithdrawByAdmin() public {
        uint256 fid = 12345;
        uint256 depositAmount = 5 * 10 ** 6; // 5 USDC

        // Setup: deposit some USDC
        usdc.mint(passenger1, depositAmount);
        vm.prank(passenger1);
        usdc.approve(address(train), depositAmount);
        vm.prank(passenger1);
        train.depositUSDC(fid, depositAmount);

        // Non-admin cannot withdraw
        vm.prank(passenger1);
        vm.expectRevert(bytes("Not an admin"));
        train.withdrawERC20(address(usdc), passenger1);

        // Admin can withdraw
        uint256 balanceBefore = usdc.balanceOf(owner);

        vm.expectEmit(true, true, false, true);
        emit UsdcWithdrawn(owner, address(usdc), depositAmount);

        vm.prank(owner); // owner is admin by default
        train.withdrawERC20(address(usdc), owner);

        assertEq(usdc.balanceOf(address(train)), 0);
        assertEq(usdc.balanceOf(owner), balanceBefore + depositAmount);
    }

    function testSetUsdcAndSetDepositCostByAdmin() public {
        address newUsdcAddress = address(0x999);
        uint256 newDepositCost = 2 * 10 ** 6; // 2 USDC

        // Non-admin cannot set USDC address
        vm.prank(passenger1);
        vm.expectRevert();
        train.setUsdc(newUsdcAddress);

        // Admin can set USDC address
        vm.expectEmit(true, true, false, false);
        emit UsdcAddressUpdated(address(usdc), newUsdcAddress);

        vm.prank(owner);
        train.setUsdc(newUsdcAddress);
        assertEq(train.usdc(), newUsdcAddress);

        // Non-admin cannot set deposit cost
        vm.prank(passenger1);
        vm.expectRevert();
        train.setDepositCost(newDepositCost);

        // Admin can set deposit cost
        uint256 oldCost = train.depositCost();
        vm.expectEmit(false, false, false, true);
        emit DepositCostUpdated(oldCost, newDepositCost);

        vm.prank(owner);
        train.setDepositCost(newDepositCost);
        assertEq(train.depositCost(), newDepositCost);
    }

    function testDepositWithInvalidFid() public {
        uint256 invalidFid = 0;
        uint256 depositAmount = 1 * 10 ** 6;

        usdc.mint(passenger1, depositAmount);
        vm.prank(passenger1);
        usdc.approve(address(train), depositAmount);

        vm.prank(passenger1);
        vm.expectRevert(abi.encodeWithSignature("InvalidFid(uint256)", invalidFid));
        train.depositUSDC(invalidFid, depositAmount);
    }

    function testMultipleDepositsForSameFid() public {
        uint256 fid = 12345;
        uint256 firstDeposit = 1 * 10 ** 6; // 1 USDC
        uint256 secondDeposit = 2 * 10 ** 6; // 2 USDC

        usdc.mint(passenger1, firstDeposit + secondDeposit);

        // First deposit
        vm.prank(passenger1);
        usdc.approve(address(train), firstDeposit);
        vm.prank(passenger1);
        train.depositUSDC(fid, firstDeposit);

        // Second deposit (cumulative)
        vm.prank(passenger1);
        usdc.approve(address(train), secondDeposit);
        vm.prank(passenger1);
        train.depositUSDC(fid, secondDeposit);

        // Should be cumulative
        assertEq(train.fidToUsdcDeposited(fid), firstDeposit + secondDeposit);
    }

    function testViewHelpers() public {
        // Test getRequiredDeposit
        assertEq(train.getRequiredDeposit(), 1 * 10 ** 6);

        // Test getUsdcBalance
        assertEq(train.getUsdcBalance(), 0);

        // Deposit some USDC
        uint256 fid = 12345;
        uint256 depositAmount = 3 * 10 ** 6;
        usdc.mint(passenger1, depositAmount);
        vm.prank(passenger1);
        usdc.approve(address(train), depositAmount);
        vm.prank(passenger1);
        train.depositUSDC(fid, depositAmount);

        // Check balance updated
        assertEq(train.getUsdcBalance(), depositAmount);
    }
}
