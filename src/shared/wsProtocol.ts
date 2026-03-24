/**
 * WebSocket protocol message types for SubFrame Server.
 *
 * Mirrors the three IPC patterns:
 *   invoke  → request/response (client sends invoke, server sends response)
 *   send    → fire-and-forget (client sends, no response)
 *   event   → server-push (server sends to subscribed clients)
 *
 * Plus auth, subscription management, and session control.
 */

// ── Client → Server ─────────────────────────────────────────────────────────

export type ClientMessage =
  | InvokeMessage
  | SendMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | AuthMessage
  | TakeoverMessage
  | PingMessage;

export interface InvokeMessage {
  type: 'invoke';
  id: string;
  channel: string;
  args: unknown[];
}

export interface SendMessage {
  type: 'send';
  channel: string;
  payload?: unknown;
}

export interface SubscribeMessage {
  type: 'subscribe';
  channels: string[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  channels: string[];
}

export interface AuthMessage {
  type: 'auth';
  token: string;
}

export interface TakeoverMessage {
  type: 'takeover';
}

export interface PingMessage {
  type: 'ping';
}

// ── Server → Client ─────────────────────────────────────────────────────────

export type ServerMessage =
  | ResponseMessage
  | ErrorMessage
  | EventMessage
  | AuthOkMessage
  | AuthFailMessage
  | SessionInUseMessage
  | SessionTakeoverMessage
  | PongMessage;

export interface ResponseMessage {
  type: 'response';
  id: string;
  result: unknown;
}

export interface ErrorMessage {
  type: 'error';
  id: string;
  code: string;
  message: string;
}

export interface EventMessage {
  type: 'event';
  channel: string;
  payload: unknown;
}

export interface AuthOkMessage {
  type: 'auth-ok';
  sessionId: string;
}

export interface AuthFailMessage {
  type: 'auth-fail';
  message: string;
}

export interface SessionInUseMessage {
  type: 'session-in-use';
  currentDevice: string;
  connectedAt: string;
}

export interface SessionTakeoverMessage {
  type: 'session-takeover';
  message: string;
}

export interface PongMessage {
  type: 'pong';
}

// ── Error Codes ─────────────────────────────────────────────────────────────

export const WS_ERRORS = {
  UNKNOWN_CHANNEL: 'UNKNOWN_CHANNEL',
  HANDLER_ERROR: 'HANDLER_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  SESSION_TAKEN: 'SESSION_TAKEN',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
} as const;
