const express = require('express');
const path = require('path');
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

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

function detectWordlist(mnemonic) {
  const words = mnemonic.trim().split(/\s+/);
  for (const [name, list] of Object.entries(WORDLISTS)) {
    if (!list) continue;
    const ok = words.every(w => list.includes(w));
    if (ok) return { name, list };
  }
  return null;
}

function normalizeNFKD(s) {
  if (typeof s.normalize === 'function') return s.normalize('NFKD');
  return s;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/convert-bitcoin-key', (req, res) => {
  try {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ error: 'No private key provided' });
    }

    const isChineseMnemonic = /[\u4e00-\u9fff]/.test(privateKey);
    
    if (isChineseMnemonic) {
      return handleMnemonicToKey(privateKey, res);
    } else {
      return handleKeyToMnemonic(privateKey, res);
    }

  } catch (error) {
    console.error('Error converting:', error);
    res.status(500).json({ error: 'Internal server error during conversion' });
  }
});

function handleKeyToMnemonic(privateKey, res) {
  try {
    let privateKeyBuffer;
    
    try {
      const ecpair = ECPairFactory(ecc);
      const decoded = ecpair.fromWIF(privateKey.trim());
      privateKeyBuffer = decoded.privateKey;
    } catch (wifError) {
      if (/^[0-9a-fA-F]{64}$/.test(privateKey.replace(/\s/g, ''))) {
        privateKeyBuffer = Buffer.from(privateKey.replace(/\s/g, ''), 'hex');
      } else {
        return res.status(400).json({ error: 'Invalid Bitcoin private key format. Please provide a valid WIF or 64-character hex string.' });
      }
    }

    let entropyBuffer = privateKeyBuffer;
    
    if (entropyBuffer.length < 32) {
      entropyBuffer = Buffer.concat([entropyBuffer, Buffer.alloc(32 - entropyBuffer.length, 0)]);
    } else if (entropyBuffer.length > 32) {
      entropyBuffer = entropyBuffer.slice(0, 32);
    }
    
    const entropyHex = entropyBuffer.toString('hex');

    const zhList = bip39.wordlists.chinese_simplified;
    const chineseMnemonic = bip39.entropyToMnemonic(entropyHex, zhList);

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

function handleMnemonicToKey(mnemonic, res) {
  try {
    const zhList = bip39.wordlists.chinese_simplified;
    const entropyHex = bip39.mnemonicToEntropy(mnemonic, zhList);
    
    let privateKeyBuffer = Buffer.from(entropyHex, 'hex');
    
    if (privateKeyBuffer.length < 32) {
      privateKeyBuffer = Buffer.concat([privateKeyBuffer, Buffer.alloc(32 - privateKeyBuffer.length, 0)]);
    } else if (privateKeyBuffer.length > 32) {
      privateKeyBuffer = privateKeyBuffer.slice(0, 32);
    }
    
    if (privateKeyBuffer.equals(Buffer.alloc(32, 0))) {
      privateKeyBuffer = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
    }
    
    const ecpair = ECPairFactory(ecc);
    const keyPair = ecpair.fromPrivateKey(privateKeyBuffer);
    const privateKeyWIF = keyPair.toWIF();
    
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