// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "openzeppelin-contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "openzeppelin-contracts/access/Ownable.sol";
import "openzeppelin-contracts/utils/Strings.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";

/*
Choo-Choo on Base is an homage to The Worm. How many wallets can Choo Choo visit?

ChooChoo can visit new wallets using the `nextStop` function. When ChooChoo moves on to its next stop, the previous holder receives a "ticket" NFT as a souvenir.

If the train gets stuck, previous passengers can "yoink" the train after a certain time:
- After 2 days of no movement, the immediate previous passenger can yoink.
- After 3 days, any previous passenger can yoink.

@author Jon Bray
@warpcast https://warpcast.com/jonbray.eth
@email me@jonbray.dev
*/
contract ChooChooTrain is ERC721Enumerable, Ownable {
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
     * - traits: IPFS URL to a traits JSON (optional, for convenience)
     */
    struct TicketData {
        string tokenURI;
        string image;
        string traits;
    }

    mapping(uint256 => TicketData) public ticketData;

    // Token ID tracker for tickets (starts at 1)
    uint256 private nextTicketId = 1;

    // ========== STATE ========== //
    string public mainImage;
    string public mainTokenURI;
    string public trainWhistle;

    // Yoink mechanic state
    uint256 public lastTransferTimestamp;
    address public previousPassenger;
    mapping(address => bool) public hasBeenPassenger;

    // ========== EVENTS ========== //
    /// @dev Emitted when a previous holder receives a ticket NFT.
    event TicketStamped(address indexed to, uint256 indexed tokenId, string traits);

    /// @dev Emitted when the main train NFT (tokenId 0) is transferred to a new passenger.
    event TrainDeparted(address indexed from, address indexed to, uint256 timestamp);

    /// @dev Emitted when a previous passenger yoinks the train to a new address.
    event Yoink(address indexed by, address indexed to, uint256 timestamp);

    // ========== ERRORS ========== //
    /// @dev Caller is not the owner nor approved for the token.
    error NotOwnerNorApproved(address caller, uint256 tokenId);
    /// @dev Address must have held the train before.
    error NotPreviousPassenger(address caller);
    /// @dev Only previous passengers can yoink.
    error NotEligibleToYoink(string reason);
    /// @dev Cannot mint or transfer to the zero address or dead address.
    error TransferToInvalidAddress(address to);
    /// @dev Cannot send the train to yourself.
    error CannotSendToCurrentPassenger(address to);
    /// @dev Cannot ride the train more than once.
    error AlreadyRodeTrain(address passenger);

    // ========== CONSTANTS ========== //
    /// @dev Commonly used burn address on Base.
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ========== MODIFIERS ========== //
    modifier onlyPreviousPassengers() {
        if (!(balanceOf(msg.sender) > 0 && msg.sender != ownerOf(0))) {
            revert NotPreviousPassenger(msg.sender);
        }
        _;
    }

    modifier notInvalidAddress(address to) {
        if (to == address(0) || to == DEAD_ADDRESS) {
            revert TransferToInvalidAddress(to);
        }
        _;
    }

    // ========== CONSTRUCTOR ========== //
    /**
     * @notice Deploys the ChooChooTrain contract and mints the original train to the deployer.
     */
    constructor() ERC721("ChooChooTrain", "CHOOCHOO") Ownable(msg.sender) {
        _safeMint(msg.sender, 0);
        lastTransferTimestamp = block.timestamp;
        hasBeenPassenger[msg.sender] = true;
        trainJourney.push(msg.sender);
    }

    // ========== TRANSFER LOGIC ========== //
    /**
     * @notice Moves the train (tokenId 0) to the next passenger and stamps a ticket for the current passenger.
     * @dev ChooChoo-themed replacement for transfer/propagate. Only the train (tokenId 0) can be moved this way.
     * @param to The address of the next passenger.
     */
    function nextStop(address to) external notInvalidAddress(to) {
        if (!_isAuthorized(ownerOf(0), _msgSender(), 0)) {
            revert NotOwnerNorApproved(_msgSender(), 0);
        }
        address from = ownerOf(0);
        if (to == from) {
            revert CannotSendToCurrentPassenger(to);
        }
        if (hasBeenPassenger[to]) {
            revert AlreadyRodeTrain(to);
        }
        previousPassenger = from;
        lastTransferTimestamp = block.timestamp;
        hasBeenPassenger[to] = true;
        _safeTransfer(from, to, 0, "");
        trainJourney.push(to);
        emit TrainDeparted(from, to, block.timestamp);
        _stampTicket(from);
    }

    /**
     * @notice Internal transfer handler for all token transfers.
     * @dev Handles both train and ticket transfers. Only the train triggers ticket stamping and state updates. Once an address has ridden the train, they cannot ride it again.
     * @param from The address sending the token.
     * @param to The address receiving the token.
     * @param tokenId The tokenId to transfer.
     * @param _data Additional data.
     *
     * @dev Handles both train and ticket transfers. Only the train triggers ticket stamping and state updates.
     */
    function _customTransfer(address from, address to, uint256 tokenId, bytes memory _data)
        internal
        notInvalidAddress(to)
    {
        // Prevent previous passengers from receiving the train again
        if (tokenId == 0 && hasBeenPassenger[to]) {
            revert AlreadyRodeTrain(to);
        }
        if (tokenId == 0) {
            if (!_isAuthorized(ownerOf(tokenId), _msgSender(), tokenId)) {
                revert NotOwnerNorApproved(_msgSender(), tokenId);
            }
            if (to == from) {
                revert CannotSendToCurrentPassenger(to);
            }
            previousPassenger = from;
            lastTransferTimestamp = block.timestamp;
            hasBeenPassenger[to] = true;
            _safeTransfer(from, to, tokenId, _data);
            trainJourney.push(to);
            emit TrainDeparted(from, to, block.timestamp);
            _stampTicket(from);
        } else {
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
        string memory defaultTokenURI = ""; // @todo: update when art is done
        string memory defaultImage = ""; // @todo: update when art is done
        string memory defaultTraits = "{}";
        uint256 tokenId = nextTicketId;
        _safeMint(to, tokenId);
        ticketData[tokenId] = TicketData({tokenURI: defaultTokenURI, image: defaultImage, traits: defaultTraits});
        ticketMintedAt[tokenId] = block.timestamp;
        nextTicketId++;
        emit TicketStamped(to, tokenId, defaultTraits);
    }

    /**
     * @notice Owner can mint a custom ticket (for airdrops, etc).
     * @param to The address to receive the ticket.
     * @param fullTokenURI URL to the metadata JSON for the ticket.
     * @param image URL to the image for the ticket.
     * @param traits URL to the traits JSON for the ticket.
     */
    function ownerMintTicket(address to, string memory fullTokenURI, string memory image, string memory traits)
        external
        onlyOwner
        notInvalidAddress(to)
    {
        uint256 tokenId = nextTicketId;
        _safeMint(to, tokenId);
        ticketData[tokenId] = TicketData({tokenURI: fullTokenURI, image: image, traits: traits});
        ticketMintedAt[tokenId] = block.timestamp;
        nextTicketId++;
        emit TicketStamped(to, tokenId, traits);
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
     * @notice Sets the train whistle sound.
     * @param _whistle The new URL to the audio file.
     */

    function setTrainWhistle(string memory _whistle) external onlyOwner {
        trainWhistle = _whistle;
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
     * @notice Allows the owner to update the traits for a ticket NFT (tokenId > 0).
     * @param tokenId The ticket tokenId to update.
     * @param newTraits The new URL to the traits JSON.
     */
    function setTicketTraits(uint256 tokenId, string memory newTraits) external onlyOwner {
        require(tokenId != 0, "Cannot update train NFT");
        ticketData[tokenId].traits = newTraits;
    }

    /**
     * @notice Returns the train whistle sound.
     * @return The URL to the audio file.
     */
    function getTrainWhistle() external view returns (string memory) {
        return trainWhistle;
    }

    /**
     * @notice Returns the complete train journey as an array of addresses.
     * @return An array of all addresses that have ever held the train, in chronological order.
     */
    function getTrainJourney() external view returns (address[] memory) {
        return trainJourney;
    }

    /**
     * @notice Returns the length of the train journey.
     * @return The number of stops the train has made.
     */
    function getTrainJourneyLength() external view returns (uint256) {
        return trainJourney.length;
    }

    /**
     * @notice Returns ticket minting timestamps for a batch of token IDs.
     * @param tokenIds Array of token IDs to query.
     * @return timestamps Array of timestamps when each ticket was minted.
     */
    function getTicketMintedAtBatch(uint256[] calldata tokenIds) external view returns (uint256[] memory timestamps) {
        require(tokenIds.length <= 200, "Batch size too large");
        timestamps = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            timestamps[i] = ticketMintedAt[tokenIds[i]];
        }
    }

    /**
     * @notice Returns token URIs for a batch of token IDs.
     * @param tokenIds Array of token IDs to query.
     * @return uris Array of token URIs.
     */
    function getTokenURIBatch(uint256[] calldata tokenIds) external view returns (string[] memory uris) {
        require(tokenIds.length <= 200, "Batch size too large");
        uris = new string[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uris[i] = tokenURI(tokenIds[i]);
        }
    }

    /**
     * @notice Allows the owner to withdraw any ERC20 tokens sent to this contract.
     * @param token The address of the ERC20 token contract.
     */
    function withdrawERC20(address token) external onlyOwner {
        IERC20 erc20 = IERC20(token);
        uint256 balance = erc20.balanceOf(address(this));
        require(balance > 0, "No ERC20 tokens to withdraw");
        require(erc20.transfer(owner(), balance), "ERC20 withdrawal failed");
    }

    // ========== YOINK MECHANIC ========== //
    /**
     * @notice Checks if a passenger is eligible to yoink the train.
     * @param caller The address to check.
     * @return canYoink True if eligible, false otherwise.
     * @return reason The reason for eligibility or ineligibility.
     */
    function isYoinkable(address caller) public view returns (bool canYoink, string memory reason) {
        if (balanceOf(caller) == 0 || caller == ownerOf(0)) {
            return (false, "Caller is not a previous passenger");
        }
        if (block.timestamp < lastTransferTimestamp + 2 days) {
            return (false, "Yoink not available yet");
        }
        if (block.timestamp < lastTransferTimestamp + 3 days) {
            if (caller == previousPassenger) {
                return (true, "Last passenger can yoink");
            } else {
                return (false, "Only last passenger can yoink at this time");
            }
        } else {
            if (hasBeenPassenger[caller]) {
                return (true, "Any previous passenger can yoink");
            } else {
                return (false, "Caller never held the train");
            }
        }
    }

    /**
     * @notice Allows a previous passenger to yoink (rescue) the train to a new address if it is stuck.
     * @param to The address to send the train to.
     */
    function yoink(address to) external onlyPreviousPassengers notInvalidAddress(to) {
        (bool canYoink, string memory reason) = isYoinkable(msg.sender);
        if (!canYoink) {
            revert NotEligibleToYoink(reason);
        }
        address from = ownerOf(0);
        if (to == from) {
            revert CannotSendToCurrentPassenger(to);
        }
        previousPassenger = from;
        lastTransferTimestamp = block.timestamp;
        hasBeenPassenger[to] = true;
        _safeTransfer(from, to, 0, "");
        trainJourney.push(to);
        emit TrainDeparted(from, to, block.timestamp);
        _stampTicket(from);
        emit Yoink(msg.sender, to, block.timestamp);
    }

    // ========== METADATA ========== //
    /**
     * @notice Returns the tokenURI for a given tokenId (train or ticket).
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
}
