#!/usr/bin/env bun
/**
 * OpenClaude Launcher
 * Automatically configures and launches OpenClaude with Ollama support
 */

import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const OLLAMA_DEFAULT_URL = 'http://localhost:11434'
const OPENCLAUDE_CONFIG_FILE = join(homedir(), '.openclaude.json')
const LAUNCHER_CONFIG_FILE = join(homedir(), '.openclaude', 'launcher-cache.json')

interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details?: {
    format?: string
    family?: string
    families?: string[]
    parameter_size?: string
    quantization_level?: string
  }
}

interface LauncherConfig {
  ollamaUrl: string
  selectedModel: string | null
  lastUsed: string
}

interface ProviderProfile {
  id: string
  name: string
  provider: 'openai' | 'anthropic'
  baseUrl: string
  model: string
  apiKey?: string
}

interface ClaudeConfig {
  providerProfiles?: ProviderProfile[]
  activeProviderProfileId?: string
  [key: string]: unknown
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(title: string) {
  console.log()
  log('═'.repeat(60), 'cyan')
  log(`  ${title}`, 'bright')
  log('═'.repeat(60), 'cyan')
  console.log()
}

async function checkOllama(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/tags`, { 
      signal: AbortSignal.timeout(3000) 
    })
    return response.ok
  } catch {
    return false
  }
}

async function getOllamaModels(url: string): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${url}/api/tags`)
    if (!response.ok) return []
    const data = await response.json()
    return data.models || []
  } catch {
    return []
  }
}

async function promptUser(question: string, defaultValue = ''): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise((resolve) => {
    const promptText = defaultValue 
      ? `${question} [${defaultValue}]: `
      : `${question}: `
    rl.question(promptText, (answer) => {
      rl.close()
      resolve(answer.trim() || defaultValue)
    })
  })
}

async function selectModel(models: OllamaModel[]): Promise<string | null> {
  if (models.length === 0) {
    log('\n⚠️  No models found in Ollama.', 'yellow')
    log('Run: ollama pull qwen3.5:4b', 'dim')
    return null
  }

  log(`\n📦 Available models (${models.length}):\n`, 'bright')
  
  // Group by family
  const grouped = new Map<string, OllamaModel[]>()
  for (const model of models) {
    const family = model.details?.family || 'Other'
    if (!grouped.has(family)) grouped.set(family, [])
    grouped.get(family)!.push(model)
  }

  let index = 1
  const modelMap = new Map<number, string>()
  
  for (const [family, familyModels] of grouped) {
    log(`  ${family}:`, 'cyan')
    for (const model of familyModels) {
      const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1)
      const params = model.details?.parameter_size || ''
      const quant = model.details?.quantization_level || ''
      const desc = [params, quant].filter(Boolean).join(' ')
      
      log(`    ${index}. ${model.name.padEnd(30)} ${desc} (${sizeGB}GB)`, 'reset')
      modelMap.set(index, model.model || model.name)
      index++
    }
    console.log()
  }

  const choice = await promptUser('Select model (number)')
  const selected = modelMap.get(parseInt(choice))
  
  if (!selected) {
    log('Invalid selection', 'red')
    return null
  }
  
  return selected
}

async function loadConfig(): Promise<LauncherConfig | null> {
  try {
    if (!existsSync(LAUNCHER_CONFIG_FILE)) return null
    const content = await Bun.file(LAUNCHER_CONFIG_FILE).text()
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function saveConfig(config: LauncherConfig): Promise<void> {
  const dir = join(homedir(), '.openclaude')
  if (!existsSync(dir)) {
    await Bun.$`mkdir -p ${dir}`
  }
  await Bun.write(LAUNCHER_CONFIG_FILE, JSON.stringify(config, null, 2))
}

async function loadOpenClaudeConfig(): Promise<ClaudeConfig> {
  try {
    if (!existsSync(OPENCLAUDE_CONFIG_FILE)) return {}
    const content = await Bun.file(OPENCLAUDE_CONFIG_FILE).text()
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function saveOpenClaudeConfig(config: ClaudeConfig): Promise<void> {
  await Bun.write(OPENCLAUDE_CONFIG_FILE, JSON.stringify(config, null, 2))
}

async function updateProviderProfile(ollamaUrl: string, model: string): Promise<void> {
  const openclaudeConfig = await loadOpenClaudeConfig()
  
  // Initialize provider profiles if not present
  if (!openclaudeConfig.providerProfiles) {
    openclaudeConfig.providerProfiles = []
  }
  
  // Find or create Ollama profile
  const profileId = 'openclaude-launcher-ollama'
  let profile = openclaudeConfig.providerProfiles.find((p: ProviderProfile) => p.id === profileId)
  
  if (profile) {
    // Update existing profile
    profile.baseUrl = `${ollamaUrl}/v1`
    profile.model = model
  } else {
    // Create new profile
    profile = {
      id: profileId,
      name: 'Ollama (Launcher)',
      provider: 'openai',
      baseUrl: `${ollamaUrl}/v1`,
      model: model
    }
    openclaudeConfig.providerProfiles.push(profile)
  }
  
  // Set as active profile
  openclaudeConfig.activeProviderProfileId = profileId
  
  await saveOpenClaudeConfig(openclaudeConfig)
  
  log(`\n✅ Provider profile saved to ~/.openclaude.json`, 'green')
  log(`   Profile: ${profile.name}`, 'dim')
  log(`   Model: ${model}`, 'dim')
  log(`   Base URL: ${profile.baseUrl}`, 'dim')
}

async function findOpenClaude(): Promise<string | null> {
  // Check common locations
  const possiblePaths = [
    join(process.cwd(), 'dist', 'openclaude.exe'),
    join(process.cwd(), 'openclaude.exe'),
    join(__dirname, '..', 'openclaude.exe'),
    join('C:', 'Program Files', 'OpenClaude', 'openclaude.exe'),
    join('C:', 'Program Files (x86)', 'OpenClaude', 'openclaude.exe'),
  ]
  
  for (const path of possiblePaths) {
    if (existsSync(path)) return path
  }
  
  // Check PATH
  try {
    const result = await Bun.$`where openclaude`.quiet()
    const paths = result.stdout.toString().trim().split('\n')
    for (const p of paths) {
      if (existsSync(p.trim())) return p.trim()
    }
  } catch {
    // Not in PATH
  }
  
  return null
}

async function main() {
  logHeader('🚀 OpenClaude Launcher')
  
  // Load or create config
  let config = await loadConfig()
  
  if (!config) {
    log('First time setup...', 'yellow')
    config = {
      ollamaUrl: OLLAMA_DEFAULT_URL,
      selectedModel: null,
      lastUsed: ''
    }
  }

  // Check Ollama
  log(`🔍 Checking Ollama at ${config.ollamaUrl}...`, 'blue')
  
  if (!(await checkOllama(config.ollamaUrl))) {
    log('\n⚠️  Ollama not detected!', 'yellow')
    log('Please ensure Ollama is running:', 'dim')
    log('  - Start the Ollama desktop app', 'dim')
    log('  - Or run: ollama serve', 'dim')
    console.log()
    
    const customUrl = await promptUser('Enter Ollama URL (or press Enter to exit)', '')
    if (!customUrl) {
      log('Exiting...', 'red')
      process.exit(1)
    }
    
    config.ollamaUrl = customUrl
    
    if (!(await checkOllama(config.ollamaUrl))) {
      log('Still cannot connect to Ollama. Exiting.', 'red')
      process.exit(1)
    }
  }
  
  log('✅ Ollama is running!', 'green')
  
  // Get models
  const models = await getOllamaModels(config.ollamaUrl)
  
  // Select or confirm model
  let selectedModel = config.selectedModel
  
  if (selectedModel && models.some(m => m.model === selectedModel || m.name === selectedModel)) {
    log(`\n📝 Current model: ${selectedModel}`, 'cyan')
    const change = await promptUser('Change model? (y/N)', 'n')
    if (change.toLowerCase() === 'y') {
      selectedModel = await selectModel(models)
    }
  } else {
    selectedModel = await selectModel(models)
  }
  
  if (!selectedModel) {
    log('No model selected. Exiting.', 'red')
    process.exit(1)
  }
  
  // Save launcher cache
  config.selectedModel = selectedModel
  config.lastUsed = new Date().toISOString()
  await saveConfig(config)
  
  // Update .claude.json with provider profile
  await updateProviderProfile(config.ollamaUrl, selectedModel)
  
  log(`\n✅ Selected: ${selectedModel}`, 'green')
  
  // Find OpenClaude
  const openClaudePath = await findOpenClaude()
  if (!openClaudePath) {
    log('\n❌ OpenClaude executable not found!', 'red')
    log('Please ensure OpenClaude is installed.', 'dim')
    process.exit(1)
  }
  
  log(`📍 Found: ${openClaudePath}`, 'dim')
  
  // Launch OpenClaude (it will read .openclaude.json for provider profile)
  log('\n🚀 Launching OpenClaude...', 'bright')
  log('   Using provider profile from ~/.openclaude.json', 'dim')
  log('   MCP servers and other settings will be respected', 'dim')
  log('─'.repeat(60), 'dim')
  console.log()
  
  // Launch OpenClaude without env vars - it will use .openclaude.json
  const child = spawn(openClaudePath, process.argv.slice(2), {
    env: process.env,
    stdio: 'inherit',
    shell: false
  })
  
  child.on('exit', (code) => {
    process.exit(code || 0)
  })
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
