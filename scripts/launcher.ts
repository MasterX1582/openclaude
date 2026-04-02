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
const CONFIG_FILE = join(homedir(), '.openclaude', 'config.json')

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
    if (!existsSync(CONFIG_FILE)) return null
    const content = await Bun.file(CONFIG_FILE).text()
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
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2))
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
  
  // Save config
  config.selectedModel = selectedModel
  config.lastUsed = new Date().toISOString()
  await saveConfig(config)
  
  log(`\n✅ Selected: ${selectedModel}`, 'green')
  
  // Find OpenClaude
  const openClaudePath = await findOpenClaude()
  if (!openClaudePath) {
    log('\n❌ OpenClaude executable not found!', 'red')
    log('Please ensure OpenClaude is installed.', 'dim')
    process.exit(1)
  }
  
  log(`📍 Found: ${openClaudePath}`, 'dim')
  
  // Set environment and launch
  log('\n🚀 Launching OpenClaude...', 'bright')
  log('─'.repeat(60), 'dim')
  console.log()
  
  const env = {
    ...process.env,
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: `${config.ollamaUrl}/v1`,
    OPENAI_MODEL: selectedModel,
  }
  
  // Launch OpenClaude
  const child = spawn(openClaudePath, process.argv.slice(2), {
    env,
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
