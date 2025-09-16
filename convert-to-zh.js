// convert-to-zh.js
// Usage: node convert-to-zh.js
// Then paste or type a mnemonic when prompted

const readline = require('readline');
const bip39 = require('bip39');
const scure = require('@scure/bip39'); // includes official BIP39 wordlists
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');

// Available wordlists to try for detecting input language
const WORDLISTS = {
  english: bip39.wordlists.english,
  spanish: bip39.wordlists.spanish || scure.wordlists.spanish,
  french: bip39.wordlists.french || scure.wordlists.french,
  italian: bip39.wordlists.italian || scure.wordlists.italian,
  japanese: bip39.wordlists.japanese || scure.wordlists.japanese,
  korean: bip39.wordlists.korean || scure.wordlists.korean,
  portuguese: bip39.wordlists.portuguese || scure.wordlists.portuguese,
  chinese_simplified: scure.wordlists.chinese_simplified,
  chinese_traditional: scure.wordlists.chinese_traditional
};

// Helper to detect which list matches all words in the mnemonic
function detectWordlist(mnemonic) {
  const words = mnemonic.trim().split(/\s+/);
  for (const [name, list] of Object.entries(WORDLISTS)) {
    if (!list) continue;
    const ok = words.every(w => list.includes(w));
    if (ok) return { name, list };
  }
  return null;
}

// Normalize input per BIP39 expectation
function normalizeNFKD(s) {
  // ensure String.prototype.normalize exists
  if (typeof s.normalize === 'function') return s.normalize('NFKD');
  return s;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise(res => rl.question(q, ans => res(ans)));
  const userInput = (await question('Paste your BIP39 mnemonic here\n> ')).trim();
  rl.close();

  if (!userInput) {
    console.error('No mnemonic provided');
    process.exit(1);
  }

  // Detect source wordlist
  const detected = detectWordlist(userInput);
  if (!detected) {
    console.warn('Could not reliably detect the input wordlist. Will try default English validation');
  } else {
    console.log('Detected wordlist:', detected.name);
  }

  // Validate mnemonic and get entropy
  const norm = normalizeNFKD(userInput);
  const isValid = detected
    ? bip39.validateMnemonic(norm, detected.list)
    : bip39.validateMnemonic(norm); // fallback to default

  if (!isValid) {
    console.error('Mnemonic failed validation for the detected/default wordlist. Check input and try again.');
    process.exit(1);
  }

  // Get entropy hex
  const entropyHex = detected
    ? bip39.mnemonicToEntropy(norm, detected.list)
    : bip39.mnemonicToEntropy(norm);

  console.log('Entropy (hex):', entropyHex);

  // Convert entropy to Simplified Chinese mnemonic using official list
  const zhList = scure.wordlists.chinese_simplified;
  const chineseMnemonic = bip39.entropyToMnemonic(entropyHex, zhList);
  console.log('Simplified Chinese mnemonic (BIP39):', chineseMnemonic);

  // Also compute seed (PBKDF2 HMAC SHA512 per BIP39) and derive Bitcoin address with BIP44
  // Normalize when creating seed
  const seed = bip39.mnemonicToSeedSync(chineseMnemonic); // libraries handle NFKD but we already normalized
  console.log('Seed (hex, first 64 chars):', seed.toString('hex').slice(0, 64), '...');

  // Derive BIP44 first address m/44'/0'/0'/0/0
  const root = bip32.fromSeed(seed); // default to Bitcoin mainnet curve
  const path = "m/44'/0'/0'/0/0";
  const child = root.derivePath(path);
  const { address } = bitcoin.payments.p2pkh({ pubkey: child.publicKey });
  console.log('BIP44 first address (P2PKH) for Bitcoin mainnet:', address);
  console.log('\nVerification suggestion: import the Simplified Chinese mnemonic into a BIP39 compatible wallet and confirm the derived address matches the one shown above');

  // Security notice
  console.log('\nSecurity notice: Never paste real mnemonics into untrusted websites or share them. Use test wallets for demos.');
}

main().catch(err => {
  console.error('Error', err);
  process.exit(1);
});
