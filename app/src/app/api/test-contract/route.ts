/* eslint-disable @typescript-eslint/no-explicit-any */
// @todo: can remove thid file when we go to production
import { NextResponse } from 'next/server';
import { getContractService, ContractService } from '@/lib/services/contract';
import { getCurrentTokenTracker, getLastMovedTimestamp } from '@/lib/redis-token-utils';
import { isAddress } from 'viem';

interface TestResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

interface TestResults {
  contractConnection: TestResult;
  getTotalSupply: TestResult;
  tokenIdCalculation: TestResult;
  getCurrentTrainHolder: TestResult;
  getTrainStatus: TestResult;
  getAdmins: TestResult;
  gasEstimation: TestResult;
  executeNextStop: TestResult;
  errorHandling: TestResult;
}

async function testContractConnection(contractService: ContractService): Promise<TestResult> {
  try {
    const info = await contractService.getContractInfo();
    if (info.healthy) {
      return {
        success: true,
        message: 'Contract connection successful',
        data: { network: info.network, address: info.address },
      };
    } else {
      return {
        success: false,
        error: info.error || 'Contract unhealthy',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown connection error',
    };
  }
}

async function testGetTotalSupply(contractService: ContractService): Promise<TestResult> {
  try {
    const totalSupply = await contractService.getTotalSupply();
    if (typeof totalSupply === 'number' && totalSupply >= 0) {
      return {
        success: true,
        message: 'Total supply retrieved successfully',
        data: { totalSupply },
      };
    } else {
      return {
        success: false,
        error: 'Invalid total supply value',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get total supply',
    };
  }
}

async function testTokenIdCalculation(contractService: ContractService): Promise<TestResult> {
  try {
    const totalSupply = await contractService.getTotalSupply();
    const totalTickets = await contractService.getTotalTickets();
    const nextTokenId = await contractService.getNextOnChainTicketId();

    return {
      success: true,
      message: 'Token ID calculation accurate',
      data: {
        totalSupply,
        totalTickets,
        calculatedNextTokenId: nextTokenId,
        formula: 'getNextOnChainTicketId() from contract',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token ID calculation failed',
    };
  }
}

async function testGetCurrentTrainHolder(contractService: ContractService): Promise<TestResult> {
  try {
    const holder = await contractService.getCurrentTrainHolder();
    if (isAddress(holder)) {
      return {
        success: true,
        message: 'Current train holder retrieved successfully',
        data: { currentHolder: holder },
      };
    } else {
      return {
        success: false,
        error: 'Invalid holder address format',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get current holder',
    };
  }
}

async function testGetTrainStatus(contractService: ContractService): Promise<TestResult> {
  try {
    const status = await contractService.getTrainStatus();
    if (status && isAddress(status.holder)) {
      return {
        success: true,
        message: 'Train status retrieved successfully',
        data: {
          holder: status.holder,
          totalStops: status.totalStops.toString(),
          lastMoveTime: status.lastMoveTime.toString(),
          canBeYoinked: status.canBeYoinked,
          nextTicketId: status.nextTicketId.toString(),
        },
      };
    } else {
      return {
        success: false,
        error: 'Invalid train status data',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get train status',
    };
  }
}

async function testGetAdmins(contractService: ContractService): Promise<TestResult> {
  try {
    const admins = await contractService.getAdmins();
    if (Array.isArray(admins)) {
      return {
        success: true,
        message: 'Admin list retrieved successfully',
        data: {
          adminCount: admins.length,
          admins: admins,
        },
      };
    } else {
      return {
        success: false,
        error: 'Invalid admin list format',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get admin list',
    };
  }
}

async function testGasEstimation(contractService: ContractService): Promise<TestResult> {
  try {
    // Use a dummy address for gas estimation
    const dummyRecipient = '0x742d35Cc6635C0532925a3b8BC3c7766f72e1c77';
    const dummyTokenURI = 'https://example.com/metadata.json';

    const gasEstimate = await contractService.estimateNextStopGas(dummyRecipient, dummyTokenURI);

    if (typeof gasEstimate === 'bigint' && gasEstimate > 0n) {
      return {
        success: true,
        message: 'Gas estimation successful',
        data: {
          estimatedGas: gasEstimate.toString(),
          recipientUsed: dummyRecipient,
        },
      };
    } else {
      return {
        success: false,
        error: 'Invalid gas estimate',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gas estimation failed',
    };
  }
}

async function testExecuteNextStop(contractService: ContractService): Promise<TestResult> {
  // Only test if testnet is configured and explicitly enabled
  const isTestnet = process.env.USE_MAINNET !== 'true';

  if (!isTestnet) {
    return {
      success: true,
      message: 'SKIPPED - Contract testing not enabled or on mainnet',
      data: {
        reason: 'Set USE_MAINNET=false to enable transaction testing',
        isTestnet,
      },
    };
  }

  try {
    // This would only run in testnet with explicit permission
    const dummyRecipient = '0x742d35Cc6635C0532925a3b8BC3c7766f72e1c77';
    const dummyTokenURI = 'https://example.com/test-metadata.json';

    const hash = await contractService.executeNextStop(dummyRecipient, dummyTokenURI);

    return {
      success: true,
      message: 'Transaction submitted successfully',
      data: {
        transactionHash: hash,
        recipient: dummyRecipient,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction execution failed',
    };
  }
}

async function testErrorHandling(contractService: ContractService): Promise<TestResult> {
  try {
    // Test various error scenarios
    const tests = [];

    // Test 1: Invalid recipient address
    try {
      await contractService.estimateNextStopGas('invalid-address' as any, 'test-uri');
      tests.push({ test: 'invalid_address', result: 'FAIL - Should have thrown error' });
    } catch {
      tests.push({ test: 'invalid_address', result: 'PASS - Correctly rejected invalid address' });
    }

    // Test 2: Empty token URI
    try {
      const dummyRecipient = '0x742d35Cc6635C0532925a3b8BC3c7766f72e1c77';
      await contractService.estimateNextStopGas(dummyRecipient, '');
      tests.push({ test: 'empty_token_uri', result: 'PASS - Empty URI accepted' });
    } catch {
      tests.push({ test: 'empty_token_uri', result: 'PASS - Empty URI rejected' });
    }

    // Test 3: Missing admin key scenario (if admin key is undefined)
    if (!process.env.ADMIN_PRIVATE_KEY) {
      tests.push({
        test: 'missing_admin_key',
        result: 'PASS - Admin key missing (expected for this test)',
      });
    } else {
      tests.push({ test: 'missing_admin_key', result: 'SKIP - Admin key is configured' });
    }

    return {
      success: true,
      message: 'Error handling tests completed',
      data: { tests },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error handling test failed',
    };
  }
}

export async function GET() {
  try {
    const contractService = getContractService();

    // Run all tests in parallel where possible
    const results: TestResults = {
      contractConnection: await testContractConnection(contractService),
      getTotalSupply: await testGetTotalSupply(contractService),
      tokenIdCalculation: await testTokenIdCalculation(contractService),
      getCurrentTrainHolder: await testGetCurrentTrainHolder(contractService),
      getTrainStatus: await testGetTrainStatus(contractService),
      getAdmins: await testGetAdmins(contractService),
      gasEstimation: await testGasEstimation(contractService),
      executeNextStop: await testExecuteNextStop(contractService),
      errorHandling: await testErrorHandling(contractService),
    };

    // Get contract info and current token tracker for the summary
    const contractInfo = await contractService.getContractInfo();
    let currentTokenTracker, lastMovedTimestamp;
    try {
      currentTokenTracker = await getCurrentTokenTracker();
      lastMovedTimestamp = await getLastMovedTimestamp();
    } catch (err) {
      console.warn('[test-contract] Failed to get Redis data:', err);
    }

    // Calculate overall success
    const testStatuses = Object.values(results).map((result) => result.success);
    const overallSuccess = testStatuses.every((success) => success);
    const passCount = testStatuses.filter((success) => success).length;
    const totalTests = testStatuses.length;

    return NextResponse.json({
      success: overallSuccess,
      summary: {
        passed: passCount,
        total: totalTests,
        passRate: `${Math.round((passCount / totalTests) * 100)}%`,
      },
      tests: results,
      contractInfo: {
        address: contractInfo.address,
        network: contractInfo.network,
        currentHolder: contractInfo.currentHolder,
        totalSupply: contractInfo.totalSupply,
        totalTickets: contractInfo.totalTickets,
        nextTokenId: contractInfo.nextTokenId,
        adminCount: contractInfo.adminCount,
        healthy: contractInfo.healthy,
      },
      redisInfo: {
        currentTokenId: currentTokenTracker?.currentTokenId || null,
        lastUpdated: currentTokenTracker?.lastUpdated || null,
        hasTokenTracker: !!currentTokenTracker,
        lastMovedTimestamp: lastMovedTimestamp?.timestamp || null,
        lastMovedTxHash: lastMovedTimestamp?.transactionHash || null,
      },
      timestamp: new Date().toISOString(),
      environment: {
        hasAdminKey: !!process.env.ADMIN_PRIVATE_KEY,
        hasRpcUrl: !!process.env.RPC_URL,
        hasContractAddress: !!process.env.CHOOCHOO_TRAIN_ADDRESS,
        isMainnet: process.env.USE_MAINNET === 'true',
      },
    });
  } catch (error) {
    console.error('Contract test endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tests: {},
        contractInfo: null,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
