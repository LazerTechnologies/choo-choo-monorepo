import { NextResponse } from "next/server";
import { getContractService } from "@/lib/services/contract";

/**
 * GET /api/deposit-config
 *
 * Returns USDC deposit configuration for the frontend.
 * This includes the USDC token address, required deposit amount, and other config.
 */
export async function GET() {
	try {
		const contractService = getContractService();

		const [usdcAddress, depositCost] = await Promise.all([
			contractService.getUsdcAddress(),
			contractService.getDepositCost(),
		]);

		return NextResponse.json({
			success: true,
			config: {
				usdcAddress,
				depositCost: depositCost.toString(),
				depositCostFormatted: `${Number(depositCost) / 10 ** 6} USDC`, // Convert to human readable
				decimals: 6,
			},
		});
	} catch (error) {
		console.error(
			"[deposit-config] Failed to get deposit configuration:",
			error,
		);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to get deposit configuration",
			},
			{ status: 500 },
		);
	}
}
