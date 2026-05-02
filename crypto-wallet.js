/**
 * crypto-wallet.js
 * Direct blockchain integration — no third-party payment processor needed.
 * Supports: ETH (native) + USDT-ERC20 on Ethereum mainnet.
 */

const { ethers } = require('ethers');

// Public ETH RPC endpoints (no API key needed)
const RPC_URLS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
];

const USDT_CONTRACT  = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_CONTRACT  = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Token configs
const TOKENS = {
  usdt: { contract: USDT_CONTRACT, decimals: 6,  symbol: 'USDT' },
  usdc: { contract: USDC_CONTRACT, decimals: 6,  symbol: 'USDC' },
};

let provider = null;
let providerIndex = 0;
let masterNode = null;   // HD root (for deriving deposit wallets)
let hotWallet  = null;   // The wallet that holds house funds + sends withdrawals

let priceCache = {};     // { eth: { usd: 0, ts: 0 }, ... }

// ── Provider with automatic fallback ──────────────────────────────────────
function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URLS[providerIndex]);
  }
  return provider;
}

function rotateProvider() {
  providerIndex = (providerIndex + 1) % RPC_URLS.length;
  provider = new ethers.JsonRpcProvider(RPC_URLS[providerIndex]);
  console.log(`[wallet] Switched to RPC: ${RPC_URLS[providerIndex]}`);
}

async function rpcCall(fn) {
  for (let attempt = 0; attempt < RPC_URLS.length; attempt++) {
    try {
      return await fn(getProvider());
    } catch (e) {
      console.warn(`[wallet] RPC error on ${RPC_URLS[providerIndex]}: ${e.message}`);
      rotateProvider();
    }
  }
  throw new Error('All RPC providers failed');
}

// ── Wallet init ────────────────────────────────────────────────────────────
function initWallet(mnemonic) {
  masterNode = ethers.HDNodeWallet.fromPhrase(mnemonic.trim());
  // Hot wallet = index 999999 (separate from user deposit wallets)
  hotWallet  = masterNode.derivePath("m/44'/60'/0'/0/999999");
  console.log(`[wallet] Hot wallet: ${hotWallet.address}`);
  return hotWallet.address;
}

function generateMnemonic() {
  return ethers.Wallet.createRandom().mnemonic.phrase;
}

// Derive a unique deposit address for a user
function deriveDepositWallet(index) {
  if (!masterNode) throw new Error('Wallet not initialized');
  const child = masterNode.derivePath(`m/44'/60'/0'/0/${index}`);
  return { address: child.address, privateKey: child.privateKey };
}

// ── Price feed ─────────────────────────────────────────────────────────────
async function getPrice(coin = 'ethereum') {
  const cached = priceCache[coin];
  if (cached && Date.now() - cached.ts < 300000) return cached.usd; // 5-min cache

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd`);
    const data = await res.json();
    const usd = data[coin]?.usd;
    if (usd) {
      priceCache[coin] = { usd, ts: Date.now() };
      return usd;
    }
  } catch (e) {
    console.warn('[wallet] Price fetch failed:', e.message);
  }
  return cached?.usd || 2500; // stale cache fallback
}

async function getEthPrice() { return getPrice('ethereum'); }

// Convert USD to ETH
async function usdToEth(usd) {
  const price = await getEthPrice();
  return parseFloat((usd / price).toFixed(8));
}

// ── Balance checks ─────────────────────────────────────────────────────────
async function getEthBalance(address) {
  const wei = await rpcCall(p => p.getBalance(address));
  return parseFloat(ethers.formatEther(wei));
}

async function getTokenBalance(address, tokenKey) {
  const token = TOKENS[tokenKey];
  if (!token) return 0;
  const contract = await rpcCall(p => {
    const c = new ethers.Contract(token.contract, ERC20_ABI, p);
    return c.balanceOf(address);
  });
  return parseFloat(ethers.formatUnits(contract, token.decimals));
}

// ── Transactions ───────────────────────────────────────────────────────────
async function sendEth(toAddress, amountEth, fromPrivateKey) {
  const p = getProvider();
  const wallet = new ethers.Wallet(fromPrivateKey, p);
  const value  = ethers.parseEther(amountEth.toFixed(8));

  // Estimate gas
  const gasPrice = (await p.getFeeData()).gasPrice;
  const gasLimit  = 21000n;
  const gasCost   = gasPrice * gasLimit;

  const balance = await p.getBalance(wallet.address);
  if (balance < value + gasCost) throw new Error('Insufficient ETH for gas');

  const tx = await wallet.sendTransaction({ to: toAddress, value, gasLimit });
  await tx.wait(1);
  return tx.hash;
}

async function sendToken(toAddress, amountHuman, tokenKey, fromPrivateKey) {
  const token  = TOKENS[tokenKey];
  const p      = getProvider();
  const wallet = new ethers.Wallet(fromPrivateKey, p);
  const contract = new ethers.Contract(token.contract, ERC20_ABI, wallet);
  const amount = ethers.parseUnits(amountHuman.toFixed(token.decimals), token.decimals);
  const tx = await contract.transfer(toAddress, amount);
  await tx.wait(1);
  return tx.hash;
}

// Sweep ETH from deposit wallet to hot wallet (collect house funds)
async function sweepEth(fromPrivateKey) {
  const p = getProvider();
  const wallet = new ethers.Wallet(fromPrivateKey, p);
  const balance = await p.getBalance(wallet.address);
  const gasPrice = (await p.getFeeData()).gasPrice;
  const gasLimit = 21000n;
  const gasCost  = gasPrice * gasLimit;
  if (balance <= gasCost + ethers.parseEther('0.0001')) return null; // dust
  const value = balance - gasCost;
  const tx = await wallet.sendTransaction({ to: hotWallet.address, value, gasLimit });
  return tx.hash;
}

// Sweep token from deposit wallet to hot wallet
async function sweepToken(fromPrivateKey, tokenKey) {
  const token  = TOKENS[tokenKey];
  const p      = getProvider();
  const wallet = new ethers.Wallet(fromPrivateKey, p);
  const contract = new ethers.Contract(token.contract, ERC20_ABI, wallet);
  const balance = await contract.balanceOf(wallet.address);
  if (balance === 0n) return null;
  const tx = await contract.transfer(hotWallet.address, balance);
  return tx.hash;
}

module.exports = {
  initWallet, generateMnemonic, deriveDepositWallet,
  getEthPrice, usdToEth, getEthBalance, getTokenBalance,
  sendEth, sendToken, sweepEth, sweepToken,
  getProvider, TOKENS,
  getHotWallet: () => hotWallet,
};
