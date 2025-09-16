A Bitcoin private key is a secret 256 bit number that controls access to your funds. In its raw form it is just a long string of bits that is impossible for humans to memorize. BIP39 solves this problem by turning long binary data into a set of human readable words. 

To create a mnemonic from a private key you treat the 32 byte private key as entropy which is just the random data that will become your mnemonic. BIP39 adds a layer of safety by computing a checksum. It hashes the 256 bit entropy using SHA256 and takes the first 8 bits of that hash. 

This checksum is appended to the original 256 bits giving a 264 bit string that is now safe to encode into words because any typo or mistake in the mnemonic can later be detected using the checksum.

The 264 bit string is then divided into 24 chunks of 11 bits each. Each 11 bit chunk is converted to a number which is used as an index into the BIP39 wordlist to select a word. T

he words can be in any supported language including Chinese Korean Japanese or other languages so that users who are not fluent in English can safely use blockchain. This demo uses the official BIP39 word list from this repo: https://github.com/bitcoin/bips/blob/master/bip-0039/chinese_simplified.txt

The 24 words are arranged in order creating a mnemonic that fully encodes the original private key. Later to recover the key you reverse the process convert words back to indices reconstruct the 264 bit binary string remove the 8 bit checksum and you are left with the original 256 bit private key. This makes the mnemonic fully reversible and safe to use as a human friendly representation of a secret key.
