/**
 * WebServerSetup — Multi-step setup wizard for SubFrame Server.
 *
 * 4 steps: Enable → SSH Tunnel → Connect → Done
 * Guides the user through enabling the web server, setting up an SSH tunnel,
 * and connecting a remote browser client.
 */

import { useState, useEffect, useCallback } from 'react';
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
  { label: 'SSH Tunnel', subtitle: 'Secure connection', icon: Shield },
  { label: 'Connect', subtitle: 'Pair your device', icon: Wifi },
  { label: 'Done', subtitle: 'Ready to go', icon: Check },
];

// ── Component ────────────────────────────────────────────────────────────────

export function WebServerSetup({ open, onOpenChange }: WebServerSetupProps) {
  const [step, setStep] = useState<StepIndex>(0);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [sshCommand, setSshCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Query server info
  const { data: serverInfo, refetch: refetchServerInfo } = useIpcQuery(
    IPC.WEB_SERVER_INFO,
    [],
    { enabled: open, refetchInterval: open ? 3000 : false }
  );

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

  // Auto-advance to Done when client connects on step 2
  useEffect(() => {
    if (step === 2 && serverInfo?.clientConnected) {
      setStep(3);
    }
  }, [step, serverInfo?.clientConnected]);

  // Fetch SSH command when entering step 1
  useEffect(() => {
    if (step === 1 && serverInfo?.enabled) {
      typedInvoke(IPC.WEB_SERVER_GET_SSH_COMMAND)
        .then((result) => setSshCommand(result.command))
        .catch(() => setSshCommand(null));
    }
  }, [step, serverInfo?.enabled]);

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
      case 1: return true;
      case 2: return !!serverInfo?.clientConnected;
      case 3: return false; // last step
      default: return false;
    }
  };

  // ── Step Renderers ──────────────────────────────────────────────────────────

  function renderStepEnable() {
    const isEnabled = serverInfo?.enabled ?? false;
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          SubFrame Server lets you access this IDE from a web browser on another device — like a tablet or phone over SSH.
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
      </div>
    );
  }

  function renderStepSSH() {
    const command = sshCommand || `ssh -L 8080:localhost:${serverInfo?.port ?? '???'} user@hostname`;
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Run this command on your remote device to create a secure SSH tunnel to the server.
        </p>

        <div className="bg-bg-deep rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Terminal className="w-3.5 h-3.5" />
            <span>SSH Tunnel Command</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-accent bg-bg-primary rounded px-2 py-1.5 break-all select-all">
              {command}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 cursor-pointer"
              onClick={() => copyToClipboard(command, 'SSH command')}
            >
              {copied === 'SSH command' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        <div className="bg-bg-secondary/50 rounded-lg p-3 text-xs text-text-tertiary space-y-1">
          <p>
            Replace <span className="font-mono text-text-secondary">user@hostname</span> with your SSH credentials.
          </p>
          <p>
            The tunnel forwards port <span className="font-mono text-text-secondary">8080</span> on the remote device to port{' '}
            <span className="font-mono text-text-secondary">{serverInfo?.port ?? '???'}</span> on this machine.
          </p>
        </div>
      </div>
    );
  }

  function renderStepConnect() {
    const connectionUrl = serverInfo
      ? `http://localhost:${serverInfo.port}/?token=${serverInfo.token}`
      : '';

    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Open the connection URL in a browser on the remote device, or use a pairing code for quick authentication.
        </p>

        {/* Connection URL */}
        <div className="bg-bg-deep rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Globe className="w-3.5 h-3.5" />
            <span>Connection URL</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono text-text-secondary bg-bg-primary rounded px-2 py-1.5 break-all select-all">
              {connectionUrl}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 cursor-pointer"
              onClick={() => copyToClipboard(connectionUrl, 'URL')}
            >
              {copied === 'URL' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Pairing Code */}
        <div className="bg-bg-deep rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <QrCode className="w-3.5 h-3.5" />
            <span>Pairing Code</span>
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
      </div>
    );
  }

  const stepRenderers = [renderStepEnable, renderStepSSH, renderStepConnect, renderStepDone];

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
