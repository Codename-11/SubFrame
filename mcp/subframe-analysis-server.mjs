#!/usr/bin/env node
/**
 * subframe-analysis-server.mjs — MCP stdio server for SubFrame onboarding analysis
 *
 * Exposes two tools to Claude:
 *   get_analysis_prompt — returns the analysis prompt from a temp file
 *   submit_analysis     — receives structured JSON results and writes to a file
 *
 * This approach mirrors agent-forge's MCP pattern: instead of pasting a large
 * prompt into the TUI, Claude discovers these tools via --mcp-config and uses
 * them for structured input/output.
 *
 * Environment variables:
 *   SUBFRAME_PROMPT_FILE  — path to the prompt text file (required)
 *   SUBFRAME_RESULT_FILE  — path where JSON result should be written (required)
 *   SUBFRAME_SESSION_ID   — session identifier for logging (optional)
 */

import fs from 'fs'
import { createInterface } from 'readline'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROMPT_FILE = process.env.SUBFRAME_PROMPT_FILE || ''
const RESULT_FILE = process.env.SUBFRAME_RESULT_FILE || ''
const SESSION_ID = process.env.SUBFRAME_SESSION_ID || 'unknown'

const SERVER_INFO = { name: 'subframe-analysis', version: '1.0.0' }
const PROTOCOL_VERSION = '2024-11-05'

// ---------------------------------------------------------------------------
// Logging (always to stderr — stdout is the MCP transport)
// ---------------------------------------------------------------------------

function log(...args) {
  process.stderr.write(`[subframe-mcp] ${args.join(' ')}\n`)
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'get_analysis_prompt',
    description:
      'Get the project analysis prompt from SubFrame. Call this first to receive ' +
      'the full analysis instructions and project context. Then follow the ' +
      'instructions in the prompt exactly.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'submit_analysis',
    description:
      'Submit the completed analysis result back to SubFrame. The result must be ' +
      'a JSON object with these top-level keys: "structure", "projectNotes", and ' +
      '"suggestedTasks". Call this exactly once when your analysis is complete.',
    inputSchema: {
      type: 'object',
      properties: {
        result: {
          type: 'object',
          description:
            'The analysis result JSON object containing structure, projectNotes, and suggestedTasks',
        },
      },
      required: ['result'],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

function handleGetAnalysisPrompt() {
  if (!PROMPT_FILE) {
    return toolError('SUBFRAME_PROMPT_FILE environment variable is not set')
  }

  try {
    if (!fs.existsSync(PROMPT_FILE)) {
      return toolError(`Prompt file not found: ${PROMPT_FILE}`)
    }
    const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8')
    if (!prompt.trim()) {
      return toolError('Prompt file is empty')
    }
    log(`Delivered analysis prompt (${prompt.length} chars) for session ${SESSION_ID}`)
    return toolResult(prompt)
  } catch (err) {
    return toolError(`Failed to read prompt file: ${err.message}`)
  }
}

function handleSubmitAnalysis(args) {
  if (!RESULT_FILE) {
    return toolError('SUBFRAME_RESULT_FILE environment variable is not set')
  }

  const result = args.result
  if (!result || typeof result !== 'object') {
    return toolError('result must be a JSON object')
  }

  // Validate minimum structure
  if (!result.structure && !result.projectNotes && !result.suggestedTasks) {
    return toolError(
      'result must contain at least one of: structure, projectNotes, suggestedTasks'
    )
  }

  try {
    const json = JSON.stringify(result, null, 2)
    fs.writeFileSync(RESULT_FILE, json, 'utf-8')
    log(`Analysis result written (${json.length} chars) to ${RESULT_FILE}`)
    return toolResult(
      'Analysis submitted successfully. SubFrame will process the results.'
    )
  } catch (err) {
    return toolError(`Failed to write result file: ${err.message}`)
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function toolResult(text) {
  return { content: [{ type: 'text', text }] }
}

function toolError(text) {
  return { content: [{ type: 'text', text }], isError: true }
}

function jsonRpcResponse(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

// ---------------------------------------------------------------------------
// JSON-RPC message handler
// ---------------------------------------------------------------------------

async function handleMessage(msg) {
  const { id, method, params } = msg

  // Notifications (no id) — no response needed
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      log('Client initialized')
    }
    return null
  }

  switch (method) {
    case 'initialize': {
      log('Initializing MCP server for SubFrame analysis...')
      return jsonRpcResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: SERVER_INFO,
      })
    }

    case 'tools/list': {
      return jsonRpcResponse(id, { tools: TOOLS })
    }

    case 'tools/call': {
      const toolName = params?.name
      const toolArgs = params?.arguments || {}

      log(`Tool call: ${toolName}`)

      let result
      switch (toolName) {
        case 'get_analysis_prompt':
          result = handleGetAnalysisPrompt()
          break
        case 'submit_analysis':
          result = handleSubmitAnalysis(toolArgs)
          break
        default:
          return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`)
      }

      return jsonRpcResponse(id, result)
    }

    default: {
      return jsonRpcError(id, -32601, `Method not found: ${method}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Stdio transport
// ---------------------------------------------------------------------------

function send(obj) {
  const line = JSON.stringify(obj)
  process.stdout.write(line + '\n')
}

const rl = createInterface({ input: process.stdin, terminal: false })

rl.on('line', async (line) => {
  const trimmed = line.trim()
  if (!trimmed) return

  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    log(`Failed to parse JSON: ${trimmed}`)
    send(jsonRpcError(null, -32700, 'Parse error'))
    return
  }

  try {
    const response = await handleMessage(msg)
    if (response !== null) {
      send(response)
    }
  } catch (err) {
    log(`Error handling message: ${err.message}`)
    send(jsonRpcError(msg.id ?? null, -32603, `Internal error: ${err.message}`))
  }
})

rl.on('close', () => {
  log('stdin closed, shutting down')
  process.exit(0)
})

// Startup diagnostics
log(
  `Server starting (session=${SESSION_ID}, prompt=${PROMPT_FILE ? 'set' : 'missing'}, result=${RESULT_FILE ? 'set' : 'missing'})`
)
