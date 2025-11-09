/**
 * Diagnostic script for investigating token inconsistencies between on-chain data,
 * Redis, Pinata, and Neynar.
 *
 * Configure the constants below before running locally.
 *
 * Usage:
 *   pnpm --filter app tsx app/scripts/backfill-missing-tokens.ts
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Redis from "ioredis";
import {
	type Address,
	type Chain,
	createPublicClient,
	decodeEventLog,
	http,
	type PublicClient,
	parseAbiItem,
	type Transport,
} from "viem";
import { base, baseSepolia } from "wagmi/chains";

import ChooChooTrainAbiJson from "../src/abi/ChooChooTrain.abi.json";
import type { NFTMetadata, TokenData } from "../src/types/nft";

// Get script directory for output file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type TicketData = {
	tokenURI: string;
	image: string;
};

type DiagnosticsClient = PublicClient<Transport, Chain | undefined>;

type DiagnosticConfig = {
	RPC_URL: string;
	CONTRACT_ADDRESS: Address;
	USE_MAINNET: boolean;
	START_TOKEN_ID: number;
	END_TOKEN_ID: number;
	REDIS_URL: string;
	PINATA_GATEWAY_URL: string;
	PINATA_JWT?: string;
	NEYNAR_API_KEY: string;
	NEYNAR_ADDRESS_TYPES: string;
};

const CONFIG: DiagnosticConfig = {
	// ----- REQUIRED: fill in before running locally -----
	RPC_URL: process.env.RPC_URL ?? "https://mainnet.base.org",
	CONTRACT_ADDRESS: "0xBF5Fa62C9851DF0F2d0d03d4e974cE1b1E2CB88d" as Address,
	USE_MAINNET: process.env.USE_MAINNET === "true",
	REDIS_URL: process.env.REDIS_URL ?? "",
	PINATA_GATEWAY_URL: "https://gateway.pinata.cloud",
	PINATA_JWT: process.env.PINATA_JWT,
	NEYNAR_API_KEY: process.env.NEYNAR_API_KEY ?? "",
	NEYNAR_ADDRESS_TYPES: "verified_address,custody_address",

	START_TOKEN_ID: Number(process.env.START_TOKEN_ID),
	END_TOKEN_ID: Number(process.env.END_TOKEN_ID),
};

// ========== Helpers ==========
const ChooChooTrainAbi = ChooChooTrainAbiJson;
const TICKET_STAMPED_EVENT = parseAbiItem(
	"event TicketStamped(address indexed to, uint256 indexed tokenId)",
);

function buildGatewayUrl(hash: string): string {
	const baseUrl = CONFIG.PINATA_GATEWAY_URL.replace(/\/$/, "");
	return `${baseUrl}/ipfs/${hash}`;
}

function stripIpfs(uri: string | null | undefined): string | null {
	if (!uri) return null;
	return uri.startsWith("ipfs://") ? uri.slice("ipfs://".length) : uri;
}

function formatIsoFromMs(value: number | null): string | null {
	if (!value) return null;
	return new Date(value).toISOString();
}

function toRange(start: number, end: number): number[] {
	const values: number[] = [];
	for (let id = start; id <= end; id++) values.push(id);
	return values;
}

async function fetchJson<T>(
	url: string,
	headers: Record<string, string> = {},
): Promise<{
	data: T | null;
	error?: string;
}> {
	try {
		const response = await fetch(url, { headers });
		if (!response.ok) {
			return {
				data: null,
				error: `HTTP ${response.status} ${response.statusText}`,
			};
		}
		const json = (await response.json()) as T;
		return { data: json };
	} catch (error) {
		return {
			data: null,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function fetchHead(
	url: string,
	headers: Record<string, string> = {},
): Promise<{
	ok: boolean;
	error?: string;
	contentType?: string | null;
	contentLength?: string | null;
}> {
	try {
		const res = await fetch(url, { method: "HEAD", headers });
		return {
			ok: res.ok,
			error: res.ok ? undefined : `HTTP ${res.status}`,
			contentType: res.headers.get("content-type"),
			contentLength: res.headers.get("content-length"),
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function summarizeRedisToken(data: TokenData | null): {
	exists: boolean;
	username?: string;
	address?: string;
	imageHash?: string;
	metadataHash?: string;
	transactionHash?: string;
} {
	if (!data) return { exists: false };
	return {
		exists: true,
		username: data.holderUsername,
		address: data.holderAddress,
		imageHash: data.imageHash,
		metadataHash: data.metadataHash,
		transactionHash: data.transactionHash,
	};
}

type NeynarUser = {
	fid: number;
	username: string;
	display_name: string;
	custody_address?: string;
	verified_addresses?: {
		eth_addresses?: string[];
		primary?: {
			eth_address?: string;
		};
	};
	profile?: {
		bio?: { text?: string };
	};
	pfp_url?: string;
};

type NeynarBulkByAddressResponse = Record<string, NeynarUser[]>;

type NeynarLookupResult = {
	address: Address | null;
	user?: NeynarUser;
	error?: string;
};

type TokenDiagnostics = {
	tokenId: number;
	onChain: {
		tokenURI?: string;
		image?: string;
		imageHash?: string | null;
		metadataHash?: string | null;
		mintedAtMs?: number | null;
		mintedAtIso?: string | null;
		mintedTo?: Address | null;
		blockNumber?: bigint | null;
		transactionHash?: `0x${string}` | null;
	};
	redis: ReturnType<typeof summarizeRedisToken>;
	redisData?: TokenData | null;
	pinata: {
		metadataUrl?: string | null;
		metadataStatus?: string;
		imageUrl?: string | null;
		imageStatus?: string;
	};
	pinataMetadata?: NFTMetadata | null;
	neynar: NeynarLookupResult;
	issues: string[];
};

async function runDiagnostics() {
	validateConfig();

	const redis = new Redis(CONFIG.REDIS_URL);
	const chain = CONFIG.USE_MAINNET ? base : baseSepolia;
	const publicClient = createPublicClient({
		chain,
		transport: http(CONFIG.RPC_URL),
	}) as DiagnosticsClient;

	const tokens: TokenDiagnostics[] = [];

	for (const tokenId of toRange(CONFIG.START_TOKEN_ID, CONFIG.END_TOKEN_ID)) {
		const issues: string[] = [];

		const [ticketDataResult, mintedAtRaw, redisRaw] = await Promise.all([
			readTicketData(publicClient, tokenId),
			readTicketMintedAt(publicClient, tokenId),
			redis.get(`token${tokenId}`),
		]);

		const redisParsed = safeJson<TokenData>(redisRaw);
		const redisSummary = summarizeRedisToken(redisParsed);

		if (!ticketDataResult.tokenURI) {
			issues.push("On-chain tokenURI missing");
		}

		const mintedEvent = await findTicketStampedEvent(publicClient, tokenId);
		if (!mintedEvent) {
			issues.push("TicketStamped event not found on-chain");
		}

		const mintedTo = mintedEvent?.args?.to ?? null;
		const transactionHash = mintedEvent?.transactionHash ?? null;
		const blockNumber = mintedEvent?.blockNumber ?? null;

		const blockTimestampMs = await resolveBlockTimestamp(
			publicClient,
			mintedEvent,
		);
		const mintedAtFromContract = mintedAtRaw
			? Number(mintedAtRaw) * 1000
			: null;
		const mintedAtMs = mintedAtFromContract ?? blockTimestampMs;

		if (!mintedTo) {
			issues.push("Unable to resolve minted recipient address from event logs");
		}

		const metadataHash = stripIpfs(ticketDataResult.tokenURI);
		const imageHash = stripIpfs(ticketDataResult.image);

		const metadataUrl = metadataHash ? buildGatewayUrl(metadataHash) : null;
		const imageUrl = imageHash ? buildGatewayUrl(imageHash) : null;

		const pinataMetadata = metadataUrl
			? await fetchJson<NFTMetadata>(metadataUrl, authHeaders())
			: { data: null, error: "No metadata hash" };
		const pinataMetadataData = pinataMetadata.data ?? null;
		if (!pinataMetadata.data) {
			issues.push(
				`Metadata unavailable via Pinata gateway: ${
					pinataMetadata.error ?? "unknown error"
				}`,
			);
		}

		const pinataImage = imageUrl
			? await fetchHead(imageUrl, authHeaders())
			: { ok: false, error: "No image hash" };
		if (!pinataImage.ok) {
			issues.push(
				`Image unavailable via Pinata gateway: ${pinataImage.error ?? "unknown error"}`,
			);
		}

		const neynarSummary = mintedTo
			? await lookupNeynarUserByAddress(mintedTo)
			: { address: null, error: "No address available for Neynar lookup" };

		if (neynarSummary.error) {
			issues.push(`Neynar lookup failed: ${neynarSummary.error}`);
		}

		if (!redisSummary.exists) {
			issues.push("Token missing from Redis");
		} else {
			if (
				metadataHash &&
				redisSummary.metadataHash &&
				metadataHash !== redisSummary.metadataHash
			) {
				issues.push(
					`Redis metadata hash (${redisSummary.metadataHash}) mismatch on-chain (${metadataHash})`,
				);
			}
			if (
				imageHash &&
				redisSummary.imageHash &&
				imageHash !== redisSummary.imageHash
			) {
				issues.push(
					`Redis image hash (${redisSummary.imageHash}) mismatch on-chain (${imageHash})`,
				);
			}
			if (
				mintedTo &&
				redisSummary.address &&
				mintedTo.toLowerCase() !== redisSummary.address.toLowerCase()
			) {
				issues.push(
					`Redis holder address (${redisSummary.address}) mismatch on-chain minted address (${mintedTo})`,
				);
			}
		}

		tokens.push({
			tokenId,
			onChain: {
				tokenURI: ticketDataResult.tokenURI ?? undefined,
				image: ticketDataResult.image ?? undefined,
				imageHash,
				metadataHash,
				mintedAtMs,
				mintedAtIso: formatIsoFromMs(mintedAtMs ?? null),
				mintedTo,
				blockNumber,
				transactionHash,
			},
			redis: redisSummary,
			redisData: redisParsed ?? null,
			pinata: {
				metadataUrl,
				metadataStatus: pinataMetadata.data
					? "available"
					: pinataMetadata.error,
				imageUrl,
				imageStatus: pinataImage.ok ? "available" : pinataImage.error,
			},
			pinataMetadata: pinataMetadataData,
			neynar: neynarSummary,
			issues,
		});
	}

	await redis.quit();

	printDiagnostics(tokens);
	writeRepairJson(tokens);
}

// ========== Detailed helpers ==========
function validateConfig(): void {
	const missing: string[] = [];
	if (!CONFIG.RPC_URL) missing.push("RPC_URL");
	if (
		!CONFIG.CONTRACT_ADDRESS ||
		CONFIG.CONTRACT_ADDRESS ===
			("0x0000000000000000000000000000000000000000" as Address)
	) {
		missing.push("CONTRACT_ADDRESS");
	}
	if (!CONFIG.NEYNAR_API_KEY) missing.push("NEYNAR_API_KEY");
	if (!CONFIG.REDIS_URL) missing.push("REDIS_URL");
	if (CONFIG.START_TOKEN_ID > CONFIG.END_TOKEN_ID) {
		throw new Error("START_TOKEN_ID must be <= END_TOKEN_ID");
	}
	if (missing.length > 0) {
		throw new Error(`Missing required configuration: ${missing.join(", ")}`);
	}
}

async function readTicketData(
	publicClient: DiagnosticsClient,
	tokenId: number,
): Promise<TicketData> {
	try {
		const result = await publicClient.readContract({
			address: CONFIG.CONTRACT_ADDRESS,
			abi: ChooChooTrainAbi,
			functionName: "ticketData",
			args: [BigInt(tokenId)],
		});
		const [tokenURI, image] = result as [string, string];
		return { tokenURI, image };
	} catch (error) {
		console.warn(
			`[diagnostic] Failed to read ticketData for token ${tokenId}:`,
			error instanceof Error ? error.message : error,
		);
		return { tokenURI: "", image: "" };
	}
}

async function readTicketMintedAt(
	publicClient: DiagnosticsClient,
	tokenId: number,
): Promise<bigint | null> {
	try {
		const result = await publicClient.readContract({
			address: CONFIG.CONTRACT_ADDRESS,
			abi: ChooChooTrainAbi,
			functionName: "ticketMintedAt",
			args: [BigInt(tokenId)],
		});
		return result as bigint;
	} catch (error) {
		console.warn(
			`[diagnostic] Failed to read ticketMintedAt for token ${tokenId}:`,
			error instanceof Error ? error.message : error,
		);
		return null;
	}
}

async function findTicketStampedEvent(
	publicClient: DiagnosticsClient,
	tokenId: number,
) {
	try {
		// Get current block to determine safe search range
		const latestBlock = await publicClient.getBlockNumber();
		const CHUNK_SIZE = 10000n; // Safe chunk size for public RPCs

		// Search in chunks from latest backwards to find the event
		let toBlock = latestBlock;
		let fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;

		while (fromBlock >= 0n) {
			try {
				const logs = await publicClient.getLogs({
					event: TICKET_STAMPED_EVENT,
					address: CONFIG.CONTRACT_ADDRESS,
					args: { tokenId: BigInt(tokenId) },
					fromBlock,
					toBlock,
				});

				if (logs.length > 0) {
					// Found it! Decode and return
					const latestLog = logs[logs.length - 1];
					const parsed = decodeEventLog({
						abi: [TICKET_STAMPED_EVENT],
						data: latestLog.data,
						topics: latestLog.topics,
					});

					return {
						...latestLog,
						args: parsed.args as { to: Address; tokenId: bigint },
					};
				}
			} catch (chunkError) {
				console.warn(
					`[diagnostic] Failed to fetch logs for token ${tokenId} in range [${fromBlock}, ${toBlock}]:`,
					chunkError instanceof Error ? chunkError.message : chunkError,
				);
			}

			// Move to next chunk backwards
			if (fromBlock === 0n) break;
			toBlock = fromBlock - 1n;
			fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;
		}

		return null;
	} catch (error) {
		console.warn(
			`[diagnostic] Failed to fetch TicketStamped event for token ${tokenId}:`,
			error instanceof Error ? error.message : error,
		);
		return null;
	}
}

async function resolveBlockTimestamp(
	publicClient: DiagnosticsClient,
	event: Awaited<ReturnType<typeof findTicketStampedEvent>> | null,
): Promise<number | null> {
	if (!event?.blockHash) return null;
	try {
		const block = await publicClient.getBlock({ blockHash: event.blockHash });
		return Number(block.timestamp) * 1000;
	} catch (error) {
		console.warn(
			`[diagnostic] Failed to fetch block timestamp for ${event.blockHash}:`,
			error instanceof Error ? error.message : error,
		);
		return null;
	}
}

function authHeaders(): Record<string, string> {
	if (!CONFIG.PINATA_JWT) return {};
	return { Authorization: CONFIG.PINATA_JWT };
}

function safeJson<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch (error) {
		console.warn("[diagnostic] Failed to parse Redis JSON:", error);
		return null;
	}
}

async function lookupNeynarUserByAddress(
	address: Address,
): Promise<NeynarLookupResult> {
	// Normalize address to lowercase for Neynar API
	const normalizedAddress = address.toLowerCase();

	// Build the endpoint URL with addresses as query parameter
	const endpoint = new URL(
		"https://api.neynar.com/v2/farcaster/user/bulk-by-address",
	);
	endpoint.searchParams.set("addresses", normalizedAddress);

	console.log(
		`[diagnostic] Looking up Neynar user for address: ${normalizedAddress}`,
	);

	const { data, error } = await fetchJson<NeynarBulkByAddressResponse>(
		endpoint.toString(),
		{
			Accept: "application/json",
			"x-api-key": CONFIG.NEYNAR_API_KEY,
		},
	);

	if (error) {
		console.warn(`[diagnostic] Neynar API error:`, error);
		return { address, error: `Neynar API error: ${error}` };
	}

	if (data) {
		const users =
			data[normalizedAddress] ??
			data[address] ??
			data[normalizedAddress.toLowerCase()];
		if (users && users.length > 0) {
			const user = users[0];
			console.log(
				`[diagnostic] ✅ Found user: ${user.username} (FID: ${user.fid})`,
			);
			return { address, user };
		}
	}

	// No user found
	console.warn(
		`[diagnostic] ❌ No Farcaster user found for address ${address}`,
	);
	return {
		address,
		error: "No Neynar user found for address",
	};
}

function printDiagnostics(tokens: TokenDiagnostics[]): void {
	const lines: string[] = [];

	const log = (msg: string) => {
		console.log(msg);
		lines.push(msg);
	};

	log("\n================ Diagnostics Report ================");
	for (const token of tokens) {
		log(`\nToken #${token.tokenId}`);
		log(
			`On-chain: ${JSON.stringify(
				{
					tokenURI: token.onChain.tokenURI,
					image: token.onChain.image,
					mintedTo: token.onChain.mintedTo,
					blockNumber: token.onChain.blockNumber?.toString(),
					transactionHash: token.onChain.transactionHash,
					mintedAtIso: token.onChain.mintedAtIso,
				},
				null,
				2,
			)}`,
		);
		log(`Redis: ${JSON.stringify(token.redis, null, 2)}`);
		log(`Pinata: ${JSON.stringify(token.pinata, null, 2)}`);
		log(`Neynar: ${JSON.stringify(token.neynar, null, 2)}`);
		if (token.issues.length === 0) {
			log("Issues: none ✅");
		} else {
			log("Issues:");
			for (const issue of token.issues) {
				log(`  - ${issue}`);
			}
		}
	}

	const missingCounts = tokens.reduce(
		(acc, token) => {
			if (!token.redis.exists) acc.redisMissing += 1;
			if (token.pinata.metadataStatus !== "available") acc.metadataMissing += 1;
			if (token.pinata.imageStatus !== "available") acc.imageMissing += 1;
			if (token.neynar.error) acc.neynarMissing += 1;
			return acc;
		},
		{ redisMissing: 0, metadataMissing: 0, imageMissing: 0, neynarMissing: 0 },
	);

	log("\nSummary:");
	log(`  Tokens inspected: ${tokens.length}`);
	log(`  Redis missing: ${missingCounts.redisMissing}`);
	log(`  Metadata unavailable: ${missingCounts.metadataMissing}`);
	log(`  Image unavailable: ${missingCounts.imageMissing}`);
	log(`  Neynar lookup failed: ${missingCounts.neynarMissing}`);
	log("===================================================\n");

	// Write to file
	const outputPath = join(__dirname, "backfill-report.md");
	const timestamp = new Date().toISOString();
	const header = `# Token Diagnostics Report\nGenerated: ${timestamp}\n\n`;
	writeFileSync(outputPath, header + lines.join("\n"), "utf-8");
	console.log(`\n📄 Report written to: ${outputPath}`);
}

type RepairJsonToken = {
	tokenId: number;
	onChain: {
		tokenURI: string | null;
		image: string | null;
		imageHash: string | null;
		metadataHash: string | null;
		mintedTo: Address | null;
		transactionHash: `0x${string}` | null;
		blockNumber: number | null;
		mintedAtMs: number | null;
		mintedAtIso: string | null;
	};
	redis: {
		exists: boolean;
		data: TokenData | null;
	};
	pinata: {
		metadataUrl: string | null;
		metadataStatus: string | undefined;
		imageUrl: string | null;
		imageStatus: string | undefined;
		metadata: NFTMetadata | null;
	};
	neynar: {
		user?: NeynarBulkByAddressResponse["users"][number];
		error?: string;
		address: Address | null;
	};
	issues: string[];
};

function writeRepairJson(tokens: TokenDiagnostics[]): void {
	const repairTokens: RepairJsonToken[] = tokens.map((token) => ({
		tokenId: token.tokenId,
		onChain: {
			tokenURI: token.onChain.tokenURI ?? null,
			image: token.onChain.image ?? null,
			imageHash: token.onChain.imageHash ?? null,
			metadataHash: token.onChain.metadataHash ?? null,
			mintedTo: token.onChain.mintedTo ?? null,
			transactionHash: token.onChain.transactionHash ?? null,
			blockNumber: token.onChain.blockNumber
				? Number(token.onChain.blockNumber)
				: null,
			mintedAtMs: token.onChain.mintedAtMs ?? null,
			mintedAtIso: token.onChain.mintedAtIso ?? null,
		},
		redis: {
			exists: token.redis.exists,
			data: token.redisData ?? null,
		},
		pinata: {
			metadataUrl: token.pinata.metadataUrl ?? null,
			metadataStatus: token.pinata.metadataStatus,
			imageUrl: token.pinata.imageUrl ?? null,
			imageStatus: token.pinata.imageStatus,
			metadata: token.pinataMetadata ?? null,
		},
		neynar: {
			address: token.neynar.address ?? null,
			user: token.neynar.user,
			error: token.neynar.error,
		},
		issues: token.issues,
	}));

	const output = {
		generatedAt: new Date().toISOString(),
		range: {
			start: CONFIG.START_TOKEN_ID,
			end: CONFIG.END_TOKEN_ID,
		},
		tokens: repairTokens,
	};

	const outputPath = join(__dirname, "backfill-data.json");
	writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
	console.log(`📝 Repair JSON written to: ${outputPath}`);
}

runDiagnostics().catch((error) => {
	console.error("[diagnostic] Script failed:", error);
	process.exitCode = 1;
});
