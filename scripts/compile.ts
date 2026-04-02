/**
 * OpenClaude compile script — creates a standalone executable
 * using a two-step process:
 * 1. Bundle with plugins (handles stubs for native deps)
 * 2. Compile the bundled output
 *
 * Usage:
 *   bun run compile           # Build for current platform
 *   bun run compile:all       # Build for all platforms
 */

import { readFileSync, existsSync, mkdirSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const version = pkg.version

// Supported targets for cross-compilation
const targets = [
  'bun-windows-x64',
  'bun-linux-x64', 
  'bun-darwin-x64',
  'bun-darwin-arm64',
]

async function bundleCode(): Promise<string> {
  console.log('📦 Bundling source code with plugins...')
  
  const result = await Bun.build({
    entrypoints: ['./src/entrypoints/cli.tsx'],
    outdir: './dist',
    target: 'node',
    format: 'esm',
    splitting: false,
    sourcemap: 'none',
    minify: true,
    naming: 'bundle.mjs',
    define: {
      'MACRO.VERSION': JSON.stringify('99.0.0'),
      'MACRO.DISPLAY_VERSION': JSON.stringify('99.0.0'),
      'MACRO.BUILD_TIME': JSON.stringify(new Date().toISOString()),
      'MACRO.ISSUES_EXPLAINER':
        JSON.stringify('report the issue at https://github.com/anthropics/claude-code/issues'),
      'MACRO.VERSION_CHANGELOG': JSON.stringify(''),
      'MACRO.PACKAGE_URL': JSON.stringify('@anthropic-ai/claude-code'),
      'MACRO.NATIVE_PACKAGE_URL': JSON.stringify('@anthropic-ai/claude-code-native'),
    },
    plugins: [
      {
        name: 'bun-bundle-shim',
        setup(build: any) {
          build.onResolve({ filter: /^bun:bundle$/ }, () => ({
            path: 'bun:bundle',
            namespace: 'bun-bundle-shim',
          }))
          build.onLoad(
            { filter: /.*/, namespace: 'bun-bundle-shim' },
            () => ({
              contents: `export function feature(name) { return false; }`,
              loader: 'js',
            }),
          )

          build.onResolve({ filter: /^react\/compiler-runtime$/ }, () => ({
            path: 'react/compiler-runtime',
            namespace: 'react-compiler-shim',
          }))
          build.onLoad(
            { filter: /.*/, namespace: 'react-compiler-shim' },
            () => ({
              contents: `export function c(size) { return new Array(size).fill(Symbol.for('react.memo_cache_sentinel')); }`,
              loader: 'js',
            }),
          )

          for (const mod of [
            'audio-capture-napi',
            'audio-capture.node',
            'image-processor-napi',
            'modifiers-napi',
            'url-handler-napi',
            'color-diff-napi',
            'sharp',
            '@anthropic-ai/mcpb',
            '@ant/claude-for-chrome-mcp',
            '@anthropic-ai/sandbox-runtime',
            'asciichart',
            'plist',
            'cacache',
            'fuse',
            'code-excerpt',
            'stack-utils',
          ]) {
            build.onResolve({ filter: new RegExp(`^${mod}$`) }, () => ({
              path: mod,
              namespace: 'native-stub',
            }))
          }
          build.onLoad(
            { filter: /.*/, namespace: 'native-stub' },
            () => ({
              contents: `
const noop = () => null;
const noopClass = class {};
const handler = {
  get(_, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return new Proxy({}, handler);
    if (prop === 'ExportResultCode') return { SUCCESS: 0, FAILED: 1 };
    if (prop === 'resourceFromAttributes') return () => ({});
    if (prop === 'SandboxRuntimeConfigSchema') return { parse: () => ({}) };
    return noop;
  }
};
const stub = new Proxy(noop, handler);
export default stub;
export const __stub = true;
export const SandboxViolationStore = null;
export const SandboxManager = new Proxy({}, { get: () => noop });
export const SandboxRuntimeConfigSchema = { parse: () => ({}) };
export const BROWSER_TOOLS = [];
export const getMcpConfigForManifest = noop;
export const ColorDiff = null;
export const ColorFile = null;
export const getSyntaxTheme = noop;
export const plot = noop;
export const createClaudeForChromeMcpServer = noop;
export const ExportResultCode = { SUCCESS: 0, FAILED: 1 };
export const resourceFromAttributes = noop;
export const Resource = noopClass;
export const SimpleSpanProcessor = noopClass;
export const BatchSpanProcessor = noopClass;
export const NodeTracerProvider = noopClass;
export const BasicTracerProvider = noopClass;
export const OTLPTraceExporter = noopClass;
export const OTLPLogExporter = noopClass;
export const OTLPMetricExporter = noopClass;
export const PrometheusExporter = noopClass;
export const LoggerProvider = noopClass;
export const SimpleLogRecordProcessor = noopClass;
export const BatchLogRecordProcessor = noopClass;
export const MeterProvider = noopClass;
export const PeriodicExportingMetricReader = noopClass;
export const trace = { getTracer: () => ({ startSpan: () => ({ end: noop, setAttribute: noop, setStatus: noop, recordException: noop }) }) };
export const context = { active: noop, with: (_, fn) => fn() };
export const SpanStatusCode = { OK: 0, ERROR: 1, UNSET: 2 };
export const ATTR_SERVICE_NAME = 'service.name';
export const ATTR_SERVICE_VERSION = 'service.version';
export const SEMRESATTRS_SERVICE_NAME = 'service.name';
export const SEMRESATTRS_SERVICE_VERSION = 'service.version';
export const AggregationTemporality = { CUMULATIVE: 0, DELTA: 1 };
export const DataPointType = { HISTOGRAM: 0, SUM: 1, GAUGE: 2 };
export const InstrumentType = { COUNTER: 0, HISTOGRAM: 1, UP_DOWN_COUNTER: 2 };
export const PushMetricExporter = noopClass;
export const SeverityNumber = {};
`,
              loader: 'js',
            }),
          )

          build.onResolve({ filter: /\.(md|txt)$/ }, (args: any) => ({
            path: args.path,
            namespace: 'text-stub',
          }))
          build.onLoad(
            { filter: /.*/, namespace: 'text-stub' },
            () => ({
              contents: `export default '';`,
              loader: 'js',
            }),
          )
        },
      },
    ],
    external: [
      '@opentelemetry/api',
      '@opentelemetry/api-logs',
      '@opentelemetry/core',
      '@opentelemetry/exporter-trace-otlp-grpc',
      '@opentelemetry/exporter-trace-otlp-http',
      '@opentelemetry/exporter-trace-otlp-proto',
      '@opentelemetry/exporter-logs-otlp-http',
      '@opentelemetry/exporter-logs-otlp-proto',
      '@opentelemetry/exporter-logs-otlp-grpc',
      '@opentelemetry/exporter-metrics-otlp-proto',
      '@opentelemetry/exporter-metrics-otlp-grpc',
      '@opentelemetry/exporter-metrics-otlp-http',
      '@opentelemetry/exporter-prometheus',
      '@opentelemetry/resources',
      '@opentelemetry/sdk-trace-base',
      '@opentelemetry/sdk-trace-node',
      '@opentelemetry/sdk-logs',
      '@opentelemetry/sdk-metrics',
      '@opentelemetry/semantic-conventions',
      '@aws-sdk/client-bedrock',
      '@aws-sdk/client-bedrock-runtime',
      '@aws-sdk/client-sts',
      '@aws-sdk/credential-providers',
      '@azure/identity',
      'google-auth-library',
    ],
  })

  if (!result.success) {
    console.error('Bundle failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  console.log('✓ Bundled to dist/bundle.mjs')
  return './dist/bundle.mjs'
}

async function compileForTarget(bundlePath: string, target?: string) {
  const outputName = target 
    ? `openclaude-${target.replace('bun-', '')}.exe` 
    : 'openclaude.exe'
  
  console.log(`\n🔨 Compiling for ${target || 'current platform'}...`)
  
  const bunExe = process.execPath
  const args = [
    'build', 
    '--compile',
    '--outfile', `./dist/${outputName}`,
    ...(target ? [`--target=${target}`] : []),
    bundlePath
  ]
  
  console.log(`  Running: ${bunExe} ${args.join(' ')}`)
  
  const proc = Bun.spawn([bunExe, ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  
  const exitCode = await proc.exited
  
  if (exitCode === 0) {
    console.log(`✓ Built: dist/${outputName}`)
  } else {
    console.error(`✗ Failed to compile for ${target || 'current platform'}`)
    process.exit(1)
  }
}

async function compileLauncher(target?: string) {
  const outputName = target 
    ? `openclaude-launcher-${target.replace('bun-', '')}.exe` 
    : 'openclaude-launcher.exe'
  
  console.log(`\n🔨 Compiling launcher for ${target || 'current platform'}...`)
  
  const bunExe = process.execPath
  const args = [
    'build', 
    '--compile',
    '--outfile', `./dist/${outputName}`,
    ...(target ? [`--target=${target}`] : []),
    './scripts/launcher.ts'
  ]
  
  console.log(`  Running: ${bunExe} ${args.join(' ')}`)
  
  const proc = Bun.spawn([bunExe, ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  
  const exitCode = await proc.exited
  
  if (exitCode === 0) {
    console.log(`✓ Built: dist/${outputName}`)
  } else {
    console.error(`✗ Failed to compile launcher for ${target || 'current platform'}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const buildAll = args.includes('--all') || args.includes('all')
  
  console.log(`🚀 OpenClaude Compiler v${version}`)
  
  // Ensure dist directory exists
  if (!existsSync('./dist')) {
    mkdirSync('./dist')
  }
  
  // Step 1: Bundle the code with plugins
  const bundlePath = await bundleCode()
  
  // Step 2: Compile the bundled code
  if (buildAll) {
    console.log('\n📦 Compiling for all platforms...')
    for (const target of targets) {
      await compileForTarget(bundlePath, target)
      await compileLauncher(target)
    }
    console.log('\n✅ All builds completed!')
    console.log('\nBinaries available in ./dist/:')
    targets.forEach(t => {
      console.log(`  - openclaude-${t.replace('bun-', '')}.exe`)
      console.log(`  - openclaude-launcher-${t.replace('bun-', '')}.exe`)
    })
  } else {
    await compileForTarget(bundlePath)
    await compileLauncher()
    console.log('\n✅ Build completed!')
    console.log('\nBinaries available at:')
    console.log('  - dist/openclaude.exe')
    console.log('  - dist/openclaude-launcher.exe')
    console.log('\nTo build for all platforms, run:')
    console.log('  bun run compile:all')
  }
}

main().catch(console.error)
