/**
 * OpenClaude installer build script
 * Creates a Windows installer using Inno Setup
 *
 * Prerequisites:
 *   - Install Inno Setup: https://jrsoftware.org/isdl.php
 *   - Compiled binary must exist at dist/openclaude.exe
 *
 * Usage:
 *   bun run installer        # Build installer
 */

import { existsSync } from 'fs'
import { $ } from 'bun'

const pkg = JSON.parse(await Bun.file('./package.json').text())
const version = pkg.version

const ISS_FILE = './scripts/installer.iss'
const REQUIRED_FILES = ['dist/openclaude.exe', 'README.md', 'LICENSE']

async function checkPrerequisites(): Promise<boolean> {
  console.log('🔍 Checking prerequisites...')

  // Check for compiled binary
  for (const file of REQUIRED_FILES) {
    if (!existsSync(file)) {
      console.error(`✗ Missing required file: ${file}`)
      console.log('\nPlease run the compile step first:')
      console.log('  bun run compile')
      return false
    }
  }
  console.log('✓ All required files present')

  // Check for Inno Setup
  const innoPaths = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 5\\ISCC.exe',
  ]

  for (const path of innoPaths) {
    if (existsSync(path)) {
      console.log(`✓ Found Inno Setup: ${path}`)
      return true
    }
  }

  console.error('\n✗ Inno Setup not found!')
  console.log('\nPlease install Inno Setup from:')
  console.log('  https://jrsoftware.org/isdl.php')
  console.log('\nAfter installation, add ISCC.exe to your PATH or rerun this script.')
  return false
}

async function findInnoSetup(): Promise<string | null> {
  const innoPaths = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 5\\ISCC.exe',
  ]

  for (const path of innoPaths) {
    if (existsSync(path)) {
      return path
    }
  }
  return null
}

async function buildInstaller() {
  console.log(`\n🚀 OpenClaude Installer Builder v${version}\n`)

  if (!(await checkPrerequisites())) {
    process.exit(1)
  }

  const innoPath = await findInnoSetup()
  if (!innoPath) {
    console.error('Could not find Inno Setup')
    process.exit(1)
  }

  console.log('\n📦 Building installer...')
  console.log(`   Using: ${innoPath}`)
  console.log(`   Script: ${ISS_FILE}`)

  try {
    // Run Inno Setup compiler
    const proc = Bun.spawn([innoPath, ISS_FILE], {
      stdout: 'inherit',
      stderr: 'inherit',
      cwd: process.cwd(),
    })

    const exitCode = await proc.exited

    if (exitCode === 0) {
      console.log('\n✅ Installer created successfully!')
      console.log(`\n📁 Output: dist/OpenClaude-v${version}-Setup.exe`)
      console.log('\nYou can now distribute this installer to users.')
      console.log('It will:')
      console.log('  - Install OpenClaude to Program Files')
      console.log('  - Add to Start Menu')
      console.log('  - Optionally add to PATH')
      console.log('  - Include uninstaller')
    } else {
      console.error(`\n✗ Installer build failed with code ${exitCode}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('\n✗ Error building installer:', error)
    process.exit(1)
  }
}

// Alternative: Create a simple ZIP distribution if Inno Setup is not available
async function createZipDistribution() {
  console.log('\n📦 Creating ZIP distribution as fallback...')

  const zipName = `OpenClaude-v${version}-windows-x64-portable.zip`

  // Check if 7z is available, otherwise use PowerShell
  try {
    const proc = Bun.spawn([
      'powershell', '-Command',
      `Compress-Archive -Path "dist/openclaude.exe","README.md","LICENSE" -DestinationPath "dist/${zipName}" -Force`
    ], {
      stdout: 'inherit',
      stderr: 'inherit',
    })

    const exitCode = await proc.exited

    if (exitCode === 0) {
      console.log(`✓ Created: dist/${zipName}`)
      console.log('\nThis is a portable version - no installer needed.')
      console.log('Users just extract and run openclaude.exe')
    }
  } catch (error) {
    console.error('Failed to create ZIP:', error)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const useZip = args.includes('--zip') || args.includes('zip')

  if (useZip) {
    await createZipDistribution()
  } else {
    await buildInstaller()
  }
}

main().catch(console.error)
