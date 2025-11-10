const { spawn } = require('child_process');
const readline = require('readline');

// Get contract address from command line arguments
const contractAddress = process.argv[2];

if (!contractAddress) {
  console.error('Error: Contract address is required');
  console.error('Usage: node verify-contract.js <contract-address>');
  process.exit(1);
}

// Validate contract address format (basic check)
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
  console.error('Error: Invalid contract address format');
  console.error(
    'Contract address should be a valid Ethereum address (0x followed by 40 hex characters)',
  );
  process.exit(1);
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function getNetworkChoice() {
  console.log('\nSelect the network for contract verification:');
  console.log('1. Base Sepolia (chain-id: 84532)');
  console.log('2. Base Mainnet (chain-id: 8453)');

  while (true) {
    const choice = await askQuestion('\nEnter your choice (1 or 2): ');

    if (choice === '1' || choice === 'sepolia') {
      return 84532;
    }if (choice === '2' || choice === 'mainnet') {
      return 8453;
    }
      console.log('Invalid choice. Please enter 1 for Base Sepolia or 2 for Base Mainnet.');
  }
}

async function verifyContract() {
  console.log(`Verifying contract at address: ${contractAddress}`);

  const chainId = await getNetworkChoice();
  const networkName = chainId === 84532 ? 'Base Sepolia' : 'Base Mainnet';

  console.log(`\nSelected network: ${networkName} (chain-id: ${chainId})`);

  const forgeArgs = [
    'verify-contract',
    '--chain-id',
    chainId.toString(),
    '--compiler-version',
    '0.8.20',
    '--num-of-optimizations',
    '99999999',
    contractAddress,
  ];

  console.log(`Running: forge ${forgeArgs.join(' ')}`);

  const forgeProcess = spawn('forge', forgeArgs, {
    stdio: 'inherit',
    shell: true,
  });

  forgeProcess.on('close', (code) => {
    rl.close();
    if (code === 0) {
      console.log('✅ Contract verification completed successfully');
    } else {
      console.error(`❌ Contract verification failed with exit code ${code}`);
      process.exit(code);
    }
  });

  forgeProcess.on('error', (error) => {
    rl.close();
    console.error('❌ Failed to start forge process:', error.message);
    console.error('Make sure forge is installed and available in your PATH');
    process.exit(1);
  });
}

verifyContract().catch((error) => {
  rl.close();
  console.error('❌ Failed to verify contract:', error);
  process.exit(1);
});
