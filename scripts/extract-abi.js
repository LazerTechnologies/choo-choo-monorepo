const fs = require('fs');
const path = require('path');

const CONTRACT_NAME = 'ChooChooTrain';

const contractArtifactPath = path.join(
  __dirname,
  '..',
  'contracts',
  'out',
  `${CONTRACT_NAME}.sol`,
  `${CONTRACT_NAME}.json`
);

const appAbiDir = path.join(__dirname, '..', 'app', 'abi');

const outputAbiPath = path.join(appAbiDir, `${CONTRACT_NAME}.abi.json`);

async function extractAbi() {
  console.log(`Extracting ABI for ${CONTRACT_NAME}...`);

  if (!fs.existsSync(contractArtifactPath)) {
    console.error(
      `Error: Contract artifact not found at ${contractArtifactPath}`
    );
    console.error(
      'Please ensure contracts are built (e.g., run `pnpm build`) before extracting ABI.'
    );
    process.exit(1);
  }

  const contractArtifact = JSON.parse(
    fs.readFileSync(contractArtifactPath, 'utf8')
  );

  if (!fs.existsSync(appAbiDir)) {
    fs.mkdirSync(appAbiDir, { recursive: true });
    console.log(`Created directory: ${appAbiDir}`);
  }

  const abi = contractArtifact.abi;
  fs.writeFileSync(outputAbiPath, JSON.stringify(abi, null, 2), 'utf8');

  console.log(`ABI extracted to ${outputAbiPath}`);
}

extractAbi().catch((error) => {
  console.error('Failed to extract ABI:', error);
  process.exit(1);
});
