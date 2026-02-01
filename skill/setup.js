#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_EXAMPLE = '.env.example';
const ENV_FILE = '.env';

console.log('========================================');
console.log('  Remote Bridge Skill - Setup');
console.log('========================================\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

console.log(`[CHECK] Node.js version: ${nodeVersion}`);
if (majorVersion < 18) {
  console.error('[ERROR] Node.js 18+ is required');
  process.exit(1);
}
console.log('[OK] Node.js version compatible\n');

// Check if we're in the skill directory
const skillDir = __dirname;
const packageJsonPath = path.join(skillDir, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  console.error('[ERROR] package.json not found. Run this script from the skill directory.');
  process.exit(1);
}

// Create .env file if it doesn't exist
const envPath = path.join(skillDir, ENV_FILE);
const envExamplePath = path.join(skillDir, ENV_EXAMPLE);

console.log('[CHECK] Environment file...');
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log(`[OK] Created ${ENV_FILE} from ${ENV_EXAMPLE}`);
  } else {
    // Create default .env
    const defaultEnv = `# Remote Bridge Skill Configuration
SKILL_PORT=3000
SKILL_HOST=0.0.0.0
SKILL_LOG_LEVEL=info
`;
    fs.writeFileSync(envPath, defaultEnv);
    console.log(`[OK] Created ${ENV_FILE} with default values`);
  }
} else {
  console.log(`[OK] ${ENV_FILE} already exists`);
}

// Validate environment variables
console.log('\n[CHECK] Validating environment variables...');
require('dotenv').config({ path: envPath });

const requiredVars = ['SKILL_PORT', 'SKILL_HOST'];
const missingVars = requiredVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.warn(`[WARN] Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('       Default values will be used.');
} else {
  console.log('[OK] All required environment variables set');
}

// Check dependencies
console.log('\n[CHECK] Dependencies...');
const nodeModulesPath = path.join(skillDir, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('[INFO] Installing dependencies...');
  try {
    execSync('npm install', { cwd: skillDir, stdio: 'inherit' });
    console.log('[OK] Dependencies installed');
  } catch (err) {
    console.error('[ERROR] Failed to install dependencies');
    process.exit(1);
  }
} else {
  console.log('[OK] Dependencies already installed');
}

// Verify required modules
console.log('\n[CHECK] Verifying required modules...');
const requiredModules = ['express', 'ws', 'cors', 'dotenv'];
const missingModules = [];

requiredModules.forEach((mod) => {
  try {
    require.resolve(mod, { paths: [skillDir] });
    console.log(`  [OK] ${mod}`);
  } catch {
    missingModules.push(mod);
    console.log(`  [MISSING] ${mod}`);
  }
});

if (missingModules.length > 0) {
  console.log('\n[INFO] Installing missing modules...');
  try {
    execSync(`npm install ${missingModules.join(' ')}`, { cwd: skillDir, stdio: 'inherit' });
    console.log('[OK] Missing modules installed');
  } catch (err) {
    console.error('[ERROR] Failed to install missing modules');
    process.exit(1);
  }
}

// Summary
console.log('\n========================================');
console.log('  Setup Complete!');
console.log('========================================\n');

console.log('Configuration:');
console.log(`  Port: ${process.env.SKILL_PORT || 3000}`);
console.log(`  Host: ${process.env.SKILL_HOST || '0.0.0.0'}`);
console.log(`  Log Level: ${process.env.SKILL_LOG_LEVEL || 'info'}`);

console.log('\nTo start the server:');
console.log('  npm start\n');

console.log('To start in development mode (auto-reload):');
console.log('  npm run dev\n');

console.log('API Endpoints:');
console.log(`  Health: http://localhost:${process.env.SKILL_PORT || 3000}/health`);
console.log(`  System: http://localhost:${process.env.SKILL_PORT || 3000}/system/info`);
console.log(`  WebSocket: ws://localhost:${process.env.SKILL_PORT || 3000}\n`);
