/**
 * WebServerSetup — Multi-step setup wizard for SubFrame Server.
 *
 * 4 steps: Enable → Access → Connect → Done
 * Access step adapts: SSH Tunnel (default) or Local Network (LAN mode).
 * LAN mode binds to 0.0.0.0 so phones/tablets on the same network can connect directly.
 */

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { typedInvoke } from '../lib/ipc';
import { useIpcQuery } from '../hooks/useIpc';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import { toast } from 'sonner';
import {
  Monitor,
  Wifi,
  QrCode,
  Check,
  Copy,
  RefreshCw,
  Globe,
  Shield,
  ChevronRight,
  ChevronLeft,
  Download,
  Terminal,
  AlertTriangle,
  Smartphone,
  Network,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface WebServerSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StepIndex = 0 | 1 | 2 | 3;

interface StepDef {
  label: string;
  subtitle: string;
  icon: typeof Monitor;
}

const STEPS: StepDef[] = [
  { label: 'Enable', subtitle: 'Start the server', icon: Monitor },
  { label: 'Access', subtitle: 'Choose method', icon: Shield },
  { label: 'Connect', subtitle: 'Pair your device', icon: Wifi },
  { label: 'Done', subtitle: 'Ready to go', icon: Check },
];

const SSH_TUNNEL_BROWSER_PORT = 8080;

// ── Component ────────────────────────────────────────────────────────────────

export function WebServerSetup({ open, onOpenChange }: WebServerSetupProps) {
  const [step, setStep] = useState<StepIndex>(0);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [sshCommand, setSshCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Query server info
  const { data: serverInfo, refetch: refetchServerInfo } = useIpcQuery(
    IPC.WEB_SERVER_INFO,
    [],
    { enabled: open, refetchInterval: open ? 3000 : false }
  );

  const isLanMode = serverInfo?.lanMode ?? false;

  // Listen for client connect/disconnect events
  useIPCEvent<{ userAgent: string; connectedAt: string }>(
    IPC.WEB_CLIENT_CONNECTED,
    useCallback(() => { refetchServerInfo(); }, [refetchServerInfo])
  );

  useIPCEvent(
    IPC.WEB_CLIENT_DISCONNECTED,
    useCallback(() => { refetchServerInfo(); }, [refetchServerInfo])
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(0);
      setPairingCode(null);
      setCopied(null);
      refetchServerInfo();
    }
  }, [open, refetchServerInfo]);

  // Generate QR code when server info changes
  useEffect(() => {
    if (serverInfo?.enabled && serverInfo.port && serverInfo.token && serverInfo.lanMode && serverInfo.lanIp) {
      const host = serverInfo.lanIp;
      const url = `http://${host}:${serverInfo.port}/?token=${serverInfo.token}`;
      QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: '#e8e6e3', light: '#0f0f10' },
      }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [serverInfo?.enabled, serverInfo?.port, serverInfo?.token, serverInfo?.lanMode, serverInfo?.lanIp]);

  // Auto-advance to Done when client connects on step 2
  useEffect(() => {
    if (step === 2 && serverInfo?.clientConnected) {
      setStep(3);
    }
  }, [step, serverInfo?.clientConnected]);

  // Fetch SSH command when entering step 1 in SSH mode
  useEffect(() => {
    if (step === 1 && serverInfo?.enabled && !isLanMode) {
      typedInvoke(IPC.WEB_SERVER_GET_SSH_COMMAND)
        .then((result) => setSshCommand(result.command))
        .catch(() => setSshCommand(null));
    }
  }, [step, serverInfo?.enabled, isLanMode]);

  async function toggleServer(enable: boolean) {
    try {
      await typedInvoke(IPC.WEB_SERVER_TOGGLE, enable);
      await refetchServerInfo();
      if (enable) toast.success('SubFrame Server started');
      else toast.success('SubFrame Server stopped');
    } catch (_err) {
      toast.error('Failed to toggle server');
    }
  }

  async function toggleLanMode(enable: boolean) {
    try {
      await typedInvoke(IPC.UPDATE_SETTING, { key: 'server.lanMode', value: enable });
      await refetchServerInfo();
      toast.success(enable ? 'LAN mode enabled' : 'SSH tunnel mode enabled');
    } catch {
      toast.error('Failed to update LAN mode');
    }
  }

  async function generatePairingCode() {
    setPairingLoading(true);
    try {
      const result = await typedInvoke(IPC.WEB_SERVER_GENERATE_PAIRING);
      setPairingCode(result.code);
    } catch {
      toast.error('Failed to generate pairing code');
    } finally {
      setPairingLoading(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const canGoNext = (): boolean => {
    switch (step) {
      case 0: return !!serverInfo?.enabled;
      case 1: return !isLanMode || !!serverInfo?.lanIp;
      case 2: return !!serverInfo?.clientConnected;
      case 3: return false;
      default: return false;
    }
  };

  // ── Step Renderers ──────────────────────────────────────────────────────────

  function renderStepEnable() {
    const isEnabled = serverInfo?.enabled ?? false;
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          SubFrame Server lets you access this IDE from a web browser on another device.
        </p>

        <div className="flex items-center justify-between bg-bg-secondary rounded-lg p-4">
          <div>
            <div className="text-sm text-text-primary font-medium">Enable Server</div>
            <div className="text-xs text-text-tertiary">Start the HTTP + WebSocket server</div>
          </div>
          <button
            onClick={() => toggleServer(!isEnabled)}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors cursor-pointer',
              isEnabled ? 'bg-accent' : 'bg-bg-tertiary'
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
              isEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
            )} />
          </button>
        </div>

        {isEnabled && serverInfo && (
          <div className="bg-bg-deep rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-text-secondary">Server running</span>
            </div>
            <div className="text-xs text-text-tertiary">
              Port: <span className="font-mono text-text-secondary">{serverInfo.port}</span>
            </div>
          </div>
        )}

        {isEnabled && (
          <p className="text-xs text-text-muted">
            Next, choose how to access the server — SSH tunnel or local network.
          </p>
        )}
      </div>
    );
  }

  function renderStepAccess() {
    const currentLanMode = serverInfo?.lanMode ?? false;
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          Choose how remote devices will connect to SubFrame.
        </p>

        {/* SSH Tunnel option */}
        <button
          onClick={() => toggleLanMode(false)}
          className={cn(
            'w-full text-left rounded-lg border p-3 transition-colors cursor-pointer',
            !currentLanMode
              ? 'border-accent bg-accent/5'
              : 'border-border-subtle bg-bg-secondary hover:bg-bg-tertiary'
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
              !currentLanMode ? 'border-accent' : 'border-border-default'
            )}>
              {!currentLanMode && <div className="w-2 h-2 rounded-full bg-accent" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-sm font-medium text-text-primary">SSH Tunnel</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">Recommended</span>
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                Run an SSH tunnel command on the remote device. Works over the internet, no firewall changes needed.
              </p>
              <p className="text-xs text-text-muted mt-1">Works on: laptop, desktop, iOS (via SSH apps)</p>
            </div>
          </div>
        </button>

        {/* LAN option */}
        <button
          onClick={() => toggleLanMode(true)}
          className={cn(
            'w-full text-left rounded-lg border p-3 transition-colors cursor-pointer',
            currentLanMode
              ? 'border-amber-500/60 bg-amber-500/5'
              : 'border-border-subtle bg-bg-secondary hover:bg-bg-tertiary'
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
              currentLanMode ? 'border-amber-400' : 'border-border-default'
            )}>
              {currentLanMode && <div className="w-2 h-2 rounded-full bg-amber-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-sm font-medium text-text-primary">Local Network</span>
                <Smartphone className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">Android friendly</span>
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                Binds to all network interfaces so any device on your Wi-Fi can connect directly — no tunnel needed.
              </p>
              <p className="text-xs text-text-muted mt-1">Works on: Android, tablet, any device on the same Wi-Fi</p>
            </div>
          </div>
        </button>

        {/* LAN warning */}
        {currentLanMode && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/80 space-y-1">
              <p className="font-medium text-amber-300">Use on trusted networks only</p>
              <p>
                LAN mode exposes the server to all devices on your network. Only enable this at home or in a private office — never on public Wi-Fi or shared networks.
              </p>
              <p>
                Connections still require a token or pairing code, but the server is network-accessible.
              </p>
            </div>
          </div>
        )}

        {/* SSH info when SSH mode */}
        {!currentLanMode && (
          <div className="bg-bg-deep rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Terminal className="w-3.5 h-3.5" />
              <span>SSH Tunnel Command</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-accent bg-bg-primary rounded px-2 py-1.5 break-all select-all">
                {sshCommand || `ssh -L 8080:localhost:${serverInfo?.port ?? '???'} user@hostname`}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 cursor-pointer"
                onClick={() => copyToClipboard(sshCommand || `ssh -L 8080:localhost:${serverInfo?.port ?? '???'} user@hostname`, 'SSH command')}
              >
                {copied === 'SSH command' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              Replace <span className="font-mono text-text-secondary">user@hostname</span> with your SSH credentials. Forwards port 8080 on the remote to port{' '}
              <span className="font-mono text-text-secondary">{serverInfo?.port ?? '???'}</span> here.
            </p>
            <p className="text-xs text-text-muted">
              After the tunnel is active, open <span className="font-mono text-text-secondary">http://localhost:{SSH_TUNNEL_BROWSER_PORT}</span> in a browser on that remote machine.
            </p>
          </div>
        )}

        {/* LAN IP when LAN mode */}
        {currentLanMode && serverInfo?.lanIp && (
          <div className="bg-bg-deep rounded-lg p-3 space-y-1.5">
            <div className="text-xs text-text-tertiary">Your local IP address</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-accent">{serverInfo.lanIp}</code>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => copyToClipboard(serverInfo.lanIp!, 'IP address')}
              >
                {copied === 'IP address' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              Devices on the same network will connect to this IP. On the next step you'll get a QR code.
            </p>
            {serverInfo.lanIps.length > 1 && (
              <p className="text-[10px] text-text-muted">
                Other detected addresses: {serverInfo.lanIps.filter((ip) => ip !== serverInfo.lanIp).join(', ')}
              </p>
            )}
          </div>
        )}

        {currentLanMode && !serverInfo?.lanIp && (
          <div className="text-xs text-text-muted bg-bg-deep rounded-lg p-3">
            No LAN IP detected. Make sure you're connected to a network.
          </div>
        )}
      </div>
    );
  }

  function renderStepConnect() {
    const host = isLanMode && serverInfo?.lanIp ? serverInfo.lanIp : 'localhost';
    const accessPort = isLanMode ? serverInfo?.port ?? 0 : SSH_TUNNEL_BROWSER_PORT;
    const baseUrl = serverInfo ? `http://${host}:${accessPort}` : '';
    const connectionUrl = serverInfo ? `${baseUrl}/?token=${serverInfo.token}` : '';

    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          {isLanMode
            ? 'Open the base URL to pair with a code, or use the tokenized connection URL directly on any device connected to this Wi-Fi.'
            : 'Run the SSH tunnel on the remote machine first. Then open the remote browser URL below on that same machine, or open the base URL and pair with a code.'}
        </p>

        {/* Android tip for LAN mode */}
        {isLanMode && (
          <div className="flex items-start gap-2.5 bg-blue-500/8 border border-blue-500/20 rounded-lg p-3">
            <Smartphone className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200/80">
              <span className="font-medium text-blue-300">Android:</span>{' '}
              Scan the QR code with your camera or Chrome — no app needed. Install as PWA via "Add to Home Screen" for a native-like experience.
            </div>
          </div>
        )}

        {/* Base URL */}
        <div className="bg-bg-deep rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Globe className="w-3.5 h-3.5" />
            <span>{isLanMode ? 'Base URL' : 'Remote Base URL (After SSH Tunnel)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono text-text-secondary bg-bg-primary rounded px-2 py-1.5 break-all select-all">
              {baseUrl}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 cursor-pointer"
              onClick={() => copyToClipboard(baseUrl, 'Base URL')}
            >
              {copied === 'Base URL' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            {isLanMode
              ? 'Open this URL and pair with a code or paste a token in the browser.'
              : `Open this URL on the remote machine after the SSH tunnel is active. This points at localhost:${SSH_TUNNEL_BROWSER_PORT} on the remote side of the tunnel, not the host machine's internal server port.`}
          </p>
        </div>

        {/* Connection URL */}
        <div className="bg-bg-deep rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Globe className="w-3.5 h-3.5" />
            <span>{isLanMode ? 'Connection URL' : 'Remote Connection URL (Token Included)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono text-text-secondary bg-bg-primary rounded px-2 py-1.5 break-all select-all">
              {connectionUrl}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 cursor-pointer"
              onClick={() => copyToClipboard(connectionUrl, 'Connection URL')}
            >
              {copied === 'Connection URL' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Open this exact URL when you want the quickest path. It includes the current auth token.
          </p>
        </div>

        {/* QR Code */}
        {qrDataUrl && isLanMode && (
          <div className="flex flex-col items-center gap-1.5 my-2">
            <img src={qrDataUrl} alt="QR Code for connection URL" className="rounded-lg" style={{ width: 200, height: 200 }} />
            {isLanMode && (
              <p className="text-[10px] text-text-muted">Scan with any device on this Wi-Fi</p>
            )}
          </div>
        )}

        {/* Pairing Code */}
        <div className="bg-bg-deep rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <QrCode className="w-3.5 h-3.5" />
            <span>Pairing Code</span>
            <span className="text-text-muted">(expires in 5 min)</span>
          </div>
          {pairingCode ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold text-accent tracking-[0.3em]">
                {pairingCode}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={generatePairingCode}
                disabled={pairingLoading}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', pairingLoading && 'animate-spin')} />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={generatePairingCode}
              disabled={pairingLoading}
            >
              {pairingLoading ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <QrCode className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate Pairing Code
            </Button>
          )}
          <p className="text-xs text-text-muted">
            Open the base URL above if you want to pair manually instead of using the tokenized connection URL.
          </p>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 px-1">
          <div className={cn(
            'w-2 h-2 rounded-full',
            serverInfo?.clientConnected ? 'bg-green-500 animate-pulse' : 'bg-bg-tertiary'
          )} />
          <span className="text-xs text-text-tertiary">
            {serverInfo?.clientConnected ? 'Client connected' : 'Waiting for connection...'}
          </span>
        </div>
      </div>
    );
  }

  function renderStepDone() {
    const clientInfo = serverInfo?.clientInfo;
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-green-500" />
          </div>
          <div className="text-sm font-medium text-text-primary">Connected</div>
          <div className="text-xs text-text-tertiary mt-1">Your remote device is linked to SubFrame</div>
        </div>

        {/* Connected device info */}
        {clientInfo && (
          <div className="bg-bg-deep rounded-lg p-3 space-y-1.5">
            <div className="text-xs text-text-tertiary">Connected Device</div>
            <div className="text-xs font-mono text-text-secondary break-all">
              {clientInfo.userAgent}
            </div>
            <div className="text-[10px] text-text-muted">
              Connected at {new Date(clientInfo.connectedAt).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* PWA hint */}
        <div className="bg-bg-secondary/50 rounded-lg p-3 flex items-start gap-2.5">
          <Download className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <div className="text-xs text-text-tertiary">
            <span className="text-text-secondary font-medium">Install as App:</span>{' '}
            In your browser, look for &quot;Add to Home Screen&quot; or &quot;Install App&quot; in the menu to use SubFrame as a standalone app.
          </div>
        </div>

        {/* LAN reminder */}
        {isLanMode && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/70">
              LAN mode is active. The server is accessible to all devices on your network. Disable it in Settings → Server when not needed.
            </p>
          </div>
        )}
      </div>
    );
  }

  const stepRenderers = [renderStepEnable, renderStepAccess, renderStepConnect, renderStepDone];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-[520px] !flex !flex-col overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-0">
          <DialogTitle className="text-base">SubFrame Server Setup</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isCompleted = i < step;
            return (
              <div key={s.label} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors',
                  isActive && 'bg-bg-secondary text-text-primary',
                  isCompleted && 'text-accent',
                  !isActive && !isCompleted && 'text-text-muted'
                )}>
                  {isCompleted ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-px',
                    isCompleted ? 'bg-accent/50' : 'bg-border-subtle'
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[240px]">
          {stepRenderers[step]()}
        </div>

        {/* Navigation buttons */}
        <div className="shrink-0 flex items-center justify-between px-6 pb-6 pt-2 border-t border-border-subtle">
          <div>
            {step > 0 && step < 3 && (
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setStep((step - 1) as StepIndex)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer text-text-tertiary"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                  onClick={() => setStep((step + 1) as StepIndex)}
                  disabled={!canGoNext()}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-accent text-bg-deep hover:bg-accent/80 cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
