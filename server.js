const express = require('express');
const path = require('path');
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Available wordlists to try for detecting input language
const WORDLISTS = {
  english: bip39.wordlists.english,
  spanish: bip39.wordlists.spanish,
  french: bip39.wordlists.french,
  italian: bip39.wordlists.italian,
  japanese: bip39.wordlists.japanese,
  korean: bip39.wordlists.korean,
  portuguese: bip39.wordlists.portuguese,
  chinese_simplified: bip39.wordlists.chinese_simplified,
  chinese_traditional: bip39.wordlists.chinese_traditional
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
  if (typeof s.normalize === 'function') return s.normalize('NFKD');
  return s;
}

// Route to serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to convert Bitcoin private key to Chinese mnemonic
app.post('/api/convert-bitcoin-key', (req, res) => {
  try {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ error: 'No private key provided' });
    }

    // Check if input is a mnemonic (contains Chinese characters)
    const isChineseMnemonic = /[\u4e00-\u9fff]/.test(privateKey);
    
    if (isChineseMnemonic) {
      // Handle mnemonic to private key conversion
      return handleMnemonicToKey(privateKey, res);
    } else {
      // Handle private key to mnemonic conversion
      return handleKeyToMnemonic(privateKey, res);
    }

  } catch (error) {
    console.error('Error converting:', error);
    res.status(500).json({ error: 'Internal server error during conversion' });
  }
});

// Function to handle private key to mnemonic conversion
function handleKeyToMnemonic(privateKey, res) {
  try {
    let privateKeyBuffer;
    
    try {
      // Try to decode as WIF (Wallet Import Format)
      const ecpair = ECPairFactory(ecc);
      const decoded = ecpair.fromWIF(privateKey.trim());
      privateKeyBuffer = decoded.privateKey;
    } catch (wifError) {
      // If WIF fails, try as raw hex
      if (/^[0-9a-fA-F]{64}$/.test(privateKey.replace(/\s/g, ''))) {
        privateKeyBuffer = Buffer.from(privateKey.replace(/\s/g, ''), 'hex');
      } else {
        return res.status(400).json({ error: 'Invalid Bitcoin private key format. Please provide a valid WIF or 64-character hex string.' });
      }
    }

    // Create deterministic entropy from private key
    // Follow proper BIP39 procedure: use full 32 bytes (256 bits) for 24-word mnemonic
    // This ensures truly reversible conversion without data loss
    let entropyBuffer = privateKeyBuffer;
    
    // Ensure we have exactly 32 bytes for 256-bit entropy
    if (entropyBuffer.length < 32) {
      // Pad with zeros if private key is shorter than 32 bytes
      entropyBuffer = Buffer.concat([entropyBuffer, Buffer.alloc(32 - entropyBuffer.length, 0)]);
    } else if (entropyBuffer.length > 32) {
      // Truncate if longer than 32 bytes (shouldn't happen with valid private keys)
      entropyBuffer = entropyBuffer.slice(0, 32);
    }
    
    const entropyHex = entropyBuffer.toString('hex');

    // Convert entropy to Simplified Chinese mnemonic using official BIP39 list
    const zhList = bip39.wordlists.chinese_simplified;
    const chineseMnemonic = bip39.entropyToMnemonic(entropyHex, zhList);

    // Generate Bitcoin address from the original private key
    const ecpair = ECPairFactory(ecc);
    const keyPair = ecpair.fromPrivateKey(privateKeyBuffer);
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });

    res.json({
      success: true,
      inputType: 'bitcoin_private_key',
      privateKeyHex: privateKeyBuffer.toString('hex'),
      chineseMnemonic: chineseMnemonic,
      bitcoinAddress: address,
      entropyHex: entropyHex
    });

  } catch (error) {
    console.error('Error converting private key to mnemonic:', error);
    res.status(500).json({ error: 'Error converting private key to mnemonic' });
  }
}

// Function to handle mnemonic to private key conversion
function handleMnemonicToKey(mnemonic, res) {
  try {
    // Convert mnemonic back to entropy
    const zhList = bip39.wordlists.chinese_simplified;
    const entropyHex = bip39.mnemonicToEntropy(mnemonic, zhList);
    
    // Convert entropy back to private key
    // Follow proper BIP39 procedure: entropy should be exactly 32 bytes (256 bits)
    let privateKeyBuffer = Buffer.from(entropyHex, 'hex');
    
    // Ensure we have exactly 32 bytes for a valid private key
    if (privateKeyBuffer.length < 32) {
      // Pad with zeros if entropy is shorter than 32 bytes
      privateKeyBuffer = Buffer.concat([privateKeyBuffer, Buffer.alloc(32 - privateKeyBuffer.length, 0)]);
    } else if (privateKeyBuffer.length > 32) {
      // Truncate if longer than 32 bytes (shouldn't happen with proper BIP39)
      privateKeyBuffer = privateKeyBuffer.slice(0, 32);
    }
    
    // Ensure the private key is valid (not zero and less than the curve order)
    if (privateKeyBuffer.equals(Buffer.alloc(32, 0))) {
      privateKeyBuffer = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
    }
    
    // Generate WIF format
    const ecpair = ECPairFactory(ecc);
    const keyPair = ecpair.fromPrivateKey(privateKeyBuffer);
    const privateKeyWIF = keyPair.toWIF();
    
    // Generate Bitcoin address
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });

    res.json({
      success: true,
      inputType: 'chinese_mnemonic',
      mnemonic: mnemonic,
      privateKey: privateKeyWIF,
      privateKeyHex: privateKeyBuffer.toString('hex'),
      bitcoinAddress: address,
      entropyHex: entropyHex
    });

  } catch (error) {
    console.error('Error converting mnemonic to private key:', error);
    res.status(500).json({ error: 'Invalid mnemonic or conversion failed' });
  }
}


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
