// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721} from "openzeppelin-contracts/token/ERC721/ERC721.sol";
import {IERC721} from "openzeppelin-contracts/token/ERC721/IERC721.sol";
import {ERC721Enumerable} from "openzeppelin-contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {Strings} from "openzeppelin-contracts/utils/Strings.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";

/*
ChooChoo is a social experiment on Farcaster, and an homage to The Worm.

ChooChoo (tokenId: 0) can visit new wallets using the `nextStop` function. When ChooChoo moves to another wallet, the previous holder receives a "ticket" NFT as a souvenir. Designed to be used exclusively through the Farcaster mini-app, functions to move the train are only callable by a mini-app controlled account.

If ChooChoo hasn't moved for the configured yoink timer period (default 12 hours), a user can "yoink" ChooChoo to their address through the Farcaster mini-app.

@author Jon Bray
@warpcast https://warpcast.com/jonbray.eth
@email me@jonbray.dev
*/
contract ChooChooTrain is ERC721Enumerable, Ownable, AccessControl {
    using Strings for uint256;

    // ========== TRACKING ========== //
    /// @dev All addresses that have ever held tokenId 0, in order.
    address[] public trainJourney;
    /// @dev The timestamp when each ticket was minted, for reconstructing the journey.
    mapping(uint256 => uint256) public ticketMintedAt;

    // ========== TICKET DATA ========== //
    /**
     * @dev Stores per-ticket metadata.
     * - tokenURI: IPFS URL to the metadata JSON
     * - image: IPFS URL to the image (optional, for convenience)
     */
    struct TicketData {
        string tokenURI;
        string image;
    }

    mapping(uint256 => TicketData) public ticketData;

    // Token ID tracker for tickets (starts at 1)
    uint256 private nextTicketId = 1;

    // ========== STATE ========== //
    string public mainImage;
    string public mainTokenURI;

    uint256 public lastTransferTimestamp;
    address public previousPassenger;
    /// @dev ChooChoo can only visit a wallet once.
    mapping(address => bool) public hasBeenPassenger;

    uint256 public yoinkTimerHours = 12;

    // ========== ADMIN MANAGEMENT ========== //
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    address[] public admins;

    // ========== USDC DEPOSIT SYSTEM ========== //
    address public usdc;
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public depositCost = 1 * 10 ** USDC_DECIMALS;
    /// @dev Cumulative USDC deposited by each FID
    mapping(uint256 => uint256) public fidToUsdcDeposited;

    // ========== EVENTS ========== //
    /// @dev Emitted when a previous holder receives a ticket NFT.
    event TicketStamped(address indexed to, uint256 indexed tokenId);

    /// @dev Emitted when the main train NFT (tokenId 0) is transferred to a new passenger.
    event TrainDeparted(address indexed from, address indexed to, uint256 timestamp);

    /// @dev Emitted when a new passenger yoinks ChooChoo.
    event Yoink(address indexed by, address indexed to, uint256 timestamp);
    event YoinkTimerUpdated(uint256 previousHours, uint256 newHours);

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    event UsdcDeposited(address indexed from, uint256 indexed fid, uint256 amount);
    event UsdcWithdrawn(address indexed to, address indexed token, uint256 amount);
    event UsdcAddressUpdated(address indexed previous, address indexed current);
    event DepositCostUpdated(uint256 previous, uint256 current);

    // ========== ERRORS ========== //
    error NotOwnerNorApproved(address caller, uint256 tokenId);
    error NotEligibleToYoink(string reason);
    error TransferToInvalidAddress(address to);
    error CannotSendToCurrentPassenger(address to);
    error AlreadyRodeTrain(address passenger);
    error InvalidFid(uint256 fid);
    error InsufficientDeposit(uint256 provided, uint256 required);
    error ERC20TransferFailed();

    // ========== CONSTANTS ========== //
    /// @dev Base burn address.
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ========== MODIFIERS ========== //

    modifier notInvalidAddress(address to) {
        if (to == address(0) || to == DEAD_ADDRESS) {
            revert TransferToInvalidAddress(to);
        }
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Not an admin");
        _;
    }

    // ========== CONSTRUCTOR ========== //
    /**
     * @notice Deploy ChooChooTrain and mint to the initial holder.
     * @param initialHolder The address to receive ChooChoo (tokenId 0) first.
     */
    constructor(address initialHolder) ERC721("ChooChoo on Base", "CHOOCHOO") Ownable(msg.sender) {
        if (initialHolder == address(0) || initialHolder == DEAD_ADDRESS) {
            revert TransferToInvalidAddress(initialHolder);
        }

        _safeMint(initialHolder, 0);
        lastTransferTimestamp = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        admins.push(msg.sender);

        usdc = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    }

    // ========== TRANSFER LOGIC ========== //
    /**
     * @notice Admin function to move train and set ticket metadata in one call.
     * @dev Used by the backend to move train and immediately set the generated ticket data.
     * @param to The address of the next passenger.
     * @param ticketTokenURI The IPFS URL for the ticket metadata.
     */
    function nextStop(address to, string memory ticketTokenURI) external onlyAdmin notInvalidAddress(to) {
        address from = ownerOf(0);
        if (to == from) {
            revert CannotSendToCurrentPassenger(to);
        }
        if (hasBeenPassenger[to]) {
            revert AlreadyRodeTrain(to);
        }

        uint256 futureTicketId = nextTicketId;

        hasBeenPassenger[from] = true;
        trainJourney.push(from);

        previousPassenger = from;
        lastTransferTimestamp = block.timestamp;
        _safeTransfer(from, to, 0, "");
        emit TrainDeparted(from, to, block.timestamp);
        _stampTicket(from);

        // Set the ticket data immediately after minting
        ticketData[futureTicketId].tokenURI = ticketTokenURI;
    }

    /**
     * @notice Internal transfer handler for all token transfers.
     * @dev Handles both train and ticket transfers. Only admins can move the train (token ID 0).
     * @param from The address sending the token.
     * @param to The address receiving the token.
     * @param tokenId The tokenId to transfer.
     * @param _data Additional data.
     */
    function _customTransfer(address from, address to, uint256 tokenId, bytes memory _data)
        internal
        notInvalidAddress(to)
    {
        if (tokenId == 0) {
            revert("Train can only be moved by admins");
        } else {
            // Regular ticket transfers
            if (!_isAuthorized(ownerOf(tokenId), _msgSender(), tokenId)) {
                revert NotOwnerNorApproved(_msgSender(), tokenId);
            }
            _safeTransfer(from, to, tokenId, _data);
        }
    }

    /**
     * @notice Standard ERC721 transferFrom, supports both train and ticket transfers.
     * @param from The address sending the token.
     * @param to The address receiving the token.
     * @param tokenId The tokenId to transfer.
     */
    function transferFrom(address from, address to, uint256 tokenId) public override(ERC721, IERC721) {
        _customTransfer(from, to, tokenId, "");
    }

    /**
     * @notice Standard ERC721 safeTransferFrom with data, supports both train and ticket transfers.
     * @param from The address sending the token.
     * @param to The address receiving the token.
     * @param tokenId The tokenId to transfer.
     * @param _data Additional data.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data)
        public
        override(ERC721, IERC721)
    {
        _customTransfer(from, to, tokenId, _data);
    }

    // ========== TICKET MINTING ========== //
    /**
     * @notice Stamps a ticket (mints a ticket NFT) for a passenger.
     * @dev Called internally when the train moves to a new passenger.
     * @param to The address of the passenger receiving the ticket.
     */
    function _stampTicket(address to) internal notInvalidAddress(to) {
        uint256 tokenId = nextTicketId;
        _safeMint(to, tokenId);
        ticketMintedAt[tokenId] = block.timestamp;
        nextTicketId++;
        emit TicketStamped(to, tokenId);
    }

    /**
     * @notice Owner can mint a custom ticket (for airdrops, etc).
     * @param to The address to receive the ticket.
     * @param fullTokenURI URL to the metadata JSON for the ticket.
     * @param image URL to the image for the ticket.
     */
    function ownerMintTicket(address to, string memory fullTokenURI, string memory image)
        external
        onlyOwner
        notInvalidAddress(to)
    {
        uint256 tokenId = nextTicketId;
        _safeMint(to, tokenId);
        ticketData[tokenId] = TicketData({tokenURI: fullTokenURI, image: image});
        ticketMintedAt[tokenId] = block.timestamp;
        nextTicketId++;
        emit TicketStamped(to, tokenId);
    }

    // ========== OWNER CONTROLS ========== //
    /**
     * @notice Sets the main image for the train NFT.
     * @param _mainImage The new URL to the image.
     */
    function setMainImage(string memory _mainImage) external onlyOwner {
        mainImage = _mainImage;
    }
    /**
     * @notice Sets the main tokenURI for the train NFT.
     * @param _mainTokenURI The new URL to the metadata JSON.
     */

    function setMainTokenURI(string memory _mainTokenURI) external onlyOwner {
        mainTokenURI = _mainTokenURI;
    }

    /**
     * @notice Allows the owner to update the tokenURI for a ticket NFT (tokenId > 0).
     * @param tokenId The ticket tokenId to update.
     * @param newTokenURI The new URL to the metadata JSON.
     */
    function setTicketTokenURI(uint256 tokenId, string memory newTokenURI) external onlyOwner {
        require(tokenId != 0, "Cannot update train NFT");
        ticketData[tokenId].tokenURI = newTokenURI;
    }

    /**
     * @notice Allows the owner to update the image for a ticket NFT (tokenId > 0).
     * @param tokenId The ticket tokenId to update.
     * @param newImage The new URL to the image.
     */
    function setTicketImage(uint256 tokenId, string memory newImage) external onlyOwner {
        require(tokenId != 0, "Cannot update train NFT");
        ticketData[tokenId].image = newImage;
    }

    /**
     * @notice Returns the complete train journey as an array of addresses.
     * @return An array of all addresses that have ever held the train, in chronological order.
     */
    function getTrainJourney() external view returns (address[] memory) {
        return trainJourney;
    }

    /**
     * @notice Returns the current holder of tokenId: 0.
     * @return The address currently holding the train.
     */
    function getCurrentTrainHolder() external view returns (address) {
        return ownerOf(0);
    }

    /**
     * @notice Returns comprehensive ChooChoo status.
     * @return holder Current train holder.
     * @return totalStops Total number of stops made.
     * @return lastMoveTime Timestamp of last movement.
     * @return canBeYoinked Whether the train can currently be yoinked.
     * @return nextTicketId_ The ID that will be assigned to the next ticket.
     */
    function getTrainStatus()
        external
        view
        returns (address holder, uint256 totalStops, uint256 lastMoveTime, bool canBeYoinked, uint256 nextTicketId_)
    {
        holder = ownerOf(0);
        totalStops = trainJourney.length;
        lastMoveTime = lastTransferTimestamp;
        canBeYoinked = block.timestamp >= lastTransferTimestamp + (yoinkTimerHours * 1 hours);
        nextTicketId_ = nextTicketId;
    }

    /**
     * @notice Returns the total number of tickets minted (excluding ChooChoo).
     * @return The total supply minus 1.
     */
    function getTotalTickets() external view returns (uint256) {
        return totalSupply() > 0 ? totalSupply() - 1 : 0;
    }

    /**
     * @notice Allows the owner to withdraw any ERC20 tokens sent to this contract.
     * @param token The address of the ERC20 token contract.
     */
    function ownerWithdrawERC20(address token) external onlyOwner {
        IERC20 erc20 = IERC20(token);
        uint256 balance = erc20.balanceOf(address(this));
        require(balance > 0, "No ERC20 tokens to withdraw");
        if (!erc20.transfer(owner(), balance)) {
            revert ERC20TransferFailed();
        }
    }

    // ========== YOINK MECHANIC ========== //
    /**
     * @notice Checks if ChooChoo can be yoinked.
     * @return canYoink True if eligible, false otherwise.
     * @return reason The reason for eligibility or ineligibility.
     */
    function isYoinkable() public view returns (bool canYoink, string memory reason) {
        if (block.timestamp < lastTransferTimestamp + (yoinkTimerHours * 1 hours)) {
            return (false, "Yoink is still on cooldown");
        }
        return (true, "ChooChoo can be yoinked!");
    }

    /**
     * @notice Allows an admin to yoink the train to a new address.
     * @param to The address to send the train to.
     */
    function yoink(address to) external onlyAdmin notInvalidAddress(to) {
        (bool canYoink, string memory reason) = isYoinkable();
        if (!canYoink) {
            revert NotEligibleToYoink(reason);
        }
        address from = ownerOf(0);
        if (to == from) {
            revert CannotSendToCurrentPassenger(to);
        }
        if (hasBeenPassenger[to]) {
            revert AlreadyRodeTrain(to);
        }

        hasBeenPassenger[from] = true;
        trainJourney.push(from);

        previousPassenger = from;
        lastTransferTimestamp = block.timestamp;
        _safeTransfer(from, to, 0, "");
        emit TrainDeparted(from, to, block.timestamp);
        _stampTicket(from);
        emit Yoink(_msgSender(), to, block.timestamp);
    }

    // ========== ADMIN CONTROLS ========== //
    /**
     * @notice Adds new admin addresses.
     * @param newAdmins Array of addresses to grant admin role.
     */
    function addAdmin(address[] calldata newAdmins) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmins.length > 0, "Must add at least one admin");

        for (uint256 i = 0; i < newAdmins.length; i++) {
            address admin = newAdmins[i];
            require(admin != address(0), "Invalid admin address");
            require(
                !hasRole(ADMIN_ROLE, admin),
                string.concat(Strings.toHexString(uint256(uint160(admin)), 20), " is already an admin")
            );

            _grantRole(ADMIN_ROLE, admin);
            admins.push(admin);
            emit AdminAdded(admin);
        }
    }

    /**
     * @notice Removes an admin address.
     * @param admin The address to revoke admin role from.
     */
    function removeAdmin(address admin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasRole(ADMIN_ROLE, admin), "Not an admin");
        _revokeRole(ADMIN_ROLE, admin);

        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }
        emit AdminRemoved(admin);
    }

    /**
     * @notice Returns all current admin addresses.
     * @dev Convenience function for the frontend.
     * @return Array of admin addresses.
     */
    function getAdmins() external view returns (address[] memory) {
        return admins;
    }

    /**
     * @notice Sets ticket metadata after minting. Only callable by admins.
     * @param tokenId The ticket tokenId to update.
     * @param fullTokenURI URL to the metadata JSON for the ticket.
     * @param image URL to the image for the ticket.
     */
    function setTicketData(uint256 tokenId, string memory fullTokenURI, string memory image) external onlyAdmin {
        require(tokenId != 0, "Cannot update train NFT");
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        ticketData[tokenId] = TicketData({tokenURI: fullTokenURI, image: image});
    }

    /**
     * @notice Sets the yoink timer in hours. Only callable by admins.
     * @param newHours The new yoink timer in hours (must be > 0).
     */
    function setYoinkTimerHours(uint256 newHours) external onlyAdmin {
        require(newHours > 0, "Yoink timer must be greater than 0");
        uint256 previousHours = yoinkTimerHours;
        yoinkTimerHours = newHours;
        emit YoinkTimerUpdated(previousHours, newHours);
    }

    // ========== USDC DEPOSIT SYSTEM ========== //
    /**
     * @notice Allows users to deposit USDC into the contract.
     * @param fid The Farcaster FID to associate with this deposit.
     * @param amount The amount of USDC to deposit (must be >= depositCost).
     */
    function depositUSDC(uint256 fid, uint256 amount) external {
        if (fid == 0) {
            revert InvalidFid(fid);
        }
        if (amount < depositCost) {
            revert InsufficientDeposit(amount, depositCost);
        }

        if (!IERC20(usdc).transferFrom(_msgSender(), address(this), amount)) {
            revert ERC20TransferFailed();
        }

        fidToUsdcDeposited[fid] += amount;

        emit UsdcDeposited(_msgSender(), fid, amount);
    }

    /**
     * @notice Sets the USDC token address. Only callable by admin.
     * @param newUsdc The new USDC token contract address.
     */
    function setUsdc(address newUsdc) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newUsdc != address(0), "I'm not letting you set the USDC address to the zero address");
        address previous = usdc;
        usdc = newUsdc;
        emit UsdcAddressUpdated(previous, newUsdc);
    }

    /**
     * @notice Sets the required deposit cost. Only callable by admin.
     * @param newCost The new deposit cost in USDC smallest units.
     */
    function setDepositCost(uint256 newCost) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 previous = depositCost;
        depositCost = newCost;
        emit DepositCostUpdated(previous, newCost);
    }

    /**
     * @notice Withdraws ERC20 tokens from the contract. Only callable by admin.
     * @param token The ERC20 token contract address.
     * @param to The address to send tokens to.
     */
    function withdrawERC20(address token, address to) external onlyAdmin {
        require(to != address(0), "Why would you do that?");
        IERC20 erc20 = IERC20(token);
        uint256 balance = erc20.balanceOf(address(this));
        require(balance > 0, "There's nothing to withdraw");
        if (!erc20.transfer(to, balance)) {
            revert ERC20TransferFailed();
        }
        emit UsdcWithdrawn(to, token, balance);
    }

    /**
     * @notice Returns the contract's USDC balance.
     * @return The USDC balance in smallest units.
     */
    function getUsdcBalance() external view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }

    // ========== METADATA ========== //
    /**
     * @notice Returns the tokenURI for a given tokenId.
     * @param tokenId The tokenId to query.
     * @return The IPFS URL to the tokenURI.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (tokenId == 0) {
            return mainTokenURI;
        } else {
            return ticketData[tokenId].tokenURI;
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
