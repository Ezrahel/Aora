// ============================================================
// AoraHQ Hosted Checkout Page
// React + TypeScript checkout with dynamic gateway SDK loading
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CreditCard, Loader2, CheckCircle, AlertCircle, 
  Shield, Lock, ArrowRight, X, AlertTriangle,
  Zap, BadgeCheck
} from "lucide-react";

interface CheckoutSession {
  id: string;
  status: 'created' | 'pending' | 'completed' | 'expired' | 'failed';
  amount: number;
  currency: string;
  interval: string;
  intervalCount: number;
  plan: {
    id: string;
    name: string;
    description: string;
    amount: number;
    currency: string;
    interval: string;
    intervalCount: number;
  } | null;
  successUrl: string;
  cancelUrl: string;
  gateway: string | null;
  gatewayMode: 'live' | 'test';
  expiresAt: string;
  customerEmail: string;
  customerName: string | null;
  publicKey: string | null;
  gatewayConfig: {
    name: string | null;
    mode: 'live' | 'test';
  };
}

interface GatewayConfig {
  name: string;
  scriptUrl: string;
  globalName: string;
  initialize: (publicKey: string, options: any) => Promise<any>;
  open: (instance: any, options: any) => Promise<void>;
  close: (instance: any) => void;
}

// Gateway SDK configurations
const GATEWAY_CONFIGS: Record<string, any> = {
  stripe: {
    name: 'stripe',
    scriptUrl: 'https://js.stripe.com/v3/',
    globalName: 'Stripe',
    initialize: async (publicKey: string) => {
      const Stripe = (window as any).Stripe;
      if (!Stripe) throw new Error('Stripe.js failed to load');
      return Stripe(publicKey);
    },
    open: async (stripe: any, options: any) => {
      const { error } = await stripe.redirectToCheckout({
        sessionId: options.sessionId,
      });
      if (error) throw error;
    },
    close: () => {},
  },
  paystack: {
    name: 'paystack',
    scriptUrl: 'https://js.paystack.co/v1/inline.js',
    globalName: 'PaystackPop',
    initialize: async (publicKey: string) => {
      return { publicKey };
    },
    open: async (config: any, options: any) => {
      const handler = (window as any).PaystackPop.setup({
        key: options.publicKey,
        email: options.email,
        amount: options.amount,
        currency: options.currency || 'NGN',
        ref: options.reference,
        metadata: options.metadata,
        onSuccess: (reference: string) => {
          options.onSuccess?.(reference);
        },
        onClose: () => {
          options.onClose?.();
        },
      });
      handler.openIframe();
    },
    close: () => {},
  },
  flutterwave: {
    name: 'flutterwave',
    scriptUrl: 'https://checkout.flutterwave.com/v3.js',
    globalName: 'FlutterwaveCheckout',
    initialize: async (publicKey: string) => {
      return { publicKey };
    },
    open: async (config: any, options: any) => {
      (window as any).FlutterwaveCheckout({
        public_key: options.publicKey,
        tx_ref: options.reference,
        amount: options.amount,
        currency: options.currency || 'NGN',
        payment_options: 'card,ussd,banktransfer',
        customer: {
          email: options.email,
          name: options.name,
        },
        callback: (response: any) => {
          options.onSuccess?.(response.tx_ref);
        },
        onclose: () => {
          options.onClose?.();
        },
      });
    },
    close: () => {},
  },
};

interface AoraCheckoutPageProps {
  sessionId: string;
  onSuccess?: (subscriptionId: string) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

export function AoraCheckoutPage({ 
  sessionId, 
  onSuccess, 
  onCancel, 
  onError 
}: AoraCheckoutPageProps) {
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState<Record<string, boolean>>({});
  
  const gatewayInstanceRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Fetch checkout session on mount
  useEffect(() => {
    let cancelled = false;
    
    async function fetchSession() {
      try {
        const response = await fetch(`/api/checkout/session/${sessionId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Failed to load session' }));
          throw new Error(error.error || 'Failed to load checkout session');
        }
        
        const data = await response.json();
        
        if (!cancelled) {
          setSession(data);
          
          // Pre-load gateway SDK if needed
          if (data.gateway && GATEWAY_CONFIGS[data.gateway]) {
            loadGatewayScript(data.gateway);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load checkout');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    fetchSession();
    
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Dynamically load gateway SDK script
  const loadGatewayScript = useCallback(async (gatewayName: string) => {
    if (scriptLoaded[gatewayName]) return;
    
    const config = GATEWAY_CONFIGS[gatewayName];
    if (!config) return;
    
    // Check if already loaded
    if ((window as any)[config.globalName]) {
      setScriptLoaded(prev => ({ ...prev, [gatewayName]: true }));
      return;
    }
    
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = config.scriptUrl;
      script.async = true;
      script.onload = () => {
        setScriptLoaded(prev => ({ ...prev, [gatewayName]: true }));
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${gatewayName} SDK`));
      document.head.appendChild(script);
    });
  }, [scriptLoaded]);

  // Initialize gateway and open payment flow
  const handlePayment = useCallback(async () => {
    if (!session || !session.publicKey || processing) return;
    
    const gatewayName = session.gateway;
    if (!gatewayName || !GATEWAY_CONFIGS[gatewayName]) {
      setError('Unsupported payment gateway');
      return;
    }
    
    // Ensure script is loaded
    if (!scriptLoaded[gatewayName]) {
      await loadGatewayScript(gatewayName);
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      const config = GATEWAY_CONFIGS[gatewayName];
      
      // Initialize gateway
      const gatewayInstance = await config.initialize(session.publicKey!);
      gatewayInstanceRef.current = gatewayInstance;
      
      // Set up cleanup
      cleanupRef.current = () => {
        if (config.close && gatewayInstanceRef.current) {
          config.close(gatewayInstanceRef.current);
        }
        gatewayInstanceRef.current = null;
      };
      
      // Prepare payment options
      const reference = `aora_${session.id}_${Date.now()}`;
      const amount = session.plan ? session.plan.amount : (session.amount * 100);
      
      const paymentOptions = {
        publicKey: session.publicKey,
        email: session.customerEmail,
        amount: amount,
        currency: session.currency,
        reference: reference,
        metadata: {
          checkoutSessionId: session.id,
          planId: session.plan?.id,
          customerEmail: session.customerEmail,
          customerName: session.customerName || '',
        },
        name: session.customerName || undefined,
        description: session.plan?.name || 'Subscription',
        onSuccess: async (reference: string) => {
          await confirmPayment(reference, session.customerEmail, session.customerName || '');
        },
        onClose: () => {
          setProcessing(false);
          cleanupRef.current?.();
        },
      };
      
      // Open payment modal
      await config.open(gatewayInstanceRef.current, paymentOptions);
      
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setProcessing(false);
      cleanupRef.current?.();
    }
  }, [session, processing, scriptLoaded, loadGatewayScript]);

  // Confirm payment with backend
  const confirmPayment = useCallback(async (paymentToken: string, email: string, name: string) => {
    if (!session) return;
    
    try {
      const response = await fetch(`/api/checkout/session/${session.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentToken,
          customerEmail: email,
          customerName: name || '',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Payment confirmation failed');
      }
      
      // Success! Close gateway and redirect
      cleanupRef.current?.();
      gatewayInstanceRef.current = null;
      
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (onSuccess) {
        onSuccess(data.subscriptionId);
      }
    } catch (err) {
      console.error('Payment confirmation error:', err);
      setError(err instanceof Error ? err.message : 'Payment confirmation failed');
      setProcessing(false);
    }
  }, [session, onSuccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--lp-bg)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <Loader2 className="h-10 w-10 text-[var(--lp-accent)] animate-spin" />
          <p className="text-[var(--lp-secondary)] text-sm">Loading checkout...</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--lp-bg)] px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold lp-text mb-2">Something went wrong</h1>
          <p className="lp-secondary mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] font-bold rounded-xl hover:opacity-90 transition"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  if (!session) return null;

  const plan = session.plan;
  const amount = plan ? (plan.amount / 100).toFixed(2) : (session.amount / 100).toFixed(2);
  const currency = plan?.currency || session.currency;
  const interval = plan?.interval || session.interval;
  const intervalCount = plan?.intervalCount || session.intervalCount;

  return (
    <div className="min-h-screen bg-[var(--lp-bg)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--lp-border)] bg-[var(--lp-bg)]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <a 
            href="/" 
            onClick={(e) => { e.preventDefault(); window.history.back(); }}
            className="flex items-center gap-2 text-[var(--lp-secondary)] hover:text-[var(--lp-text)] transition"
          >
            <span className="text-xl">←</span>
            <span className="text-sm font-medium">Back</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase tracking-widest lp-secondary">
              {session.gateway?.toUpperCase()} {session.gatewayMode?.toUpperCase()}
            </span>
            {session.gateway && (
              <div className="flex items-center gap-1.5 text-xs lp-secondary">
                <Shield className="h-3 w-3" />
                <span>Secure</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={session.status}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            
            {/* Plan Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lp-card border lp-border-glass rounded-3xl p-6 md:p-8"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full lp-surface border lp-border-glass">
                  <span className="text-[10px] font-bold uppercase tracking-widest lp-secondary">
                    {intervalCount > 1 ? `${intervalCount} ${interval}s` : interval}
                  </span>
                  <span className="text-xs lp-muted">billed {interval}</span>
                </div>
                
                <h1 className="text-2xl md:text-3xl font-bold lp-text tracking-tight">
                  {plan?.name || 'Subscription'}
                </h1>
                
                <p className="text-lg lp-secondary max-w-lg mx-auto">
                  {plan?.description || 'Start your subscription today'}
                </p>
                
                <div className="flex items-baseline justify-center gap-1 pt-2">
                  <span className="text-4xl md:text-5xl font-black lp-text font-mono">
                    {currency === 'USD' ? '$' : currency === 'NGN' ? '₦' : currency}
                    {amount}
                  </span>
                  <span className="text-lg lp-secondary self-end pb-1">
                    /{intervalCount > 1 ? `${intervalCount} ${interval}s` : interval}
                  </span>
                </div>
              </div>
              
              {session.customerEmail && (
                <div className="mt-6 pt-6 border-t lp-border-glass flex items-center justify-center gap-3 text-sm">
                  <div className="flex items-center gap-2 lp-secondary">
                    <span className="h-8 w-8 rounded-full bg-[var(--lp-surface)] flex items-center justify-center">
                      {session.customerName?.[0]?.toUpperCase() || session.customerEmail[0].toUpperCase()}
                    </span>
                    <div className="text-left">
                      <p className="lp-text font-medium">{session.customerName || session.customerEmail}</p>
                      <p className="lp-secondary text-xs">{session.customerEmail}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Payment Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handlePayment}
              disabled={processing || !session.publicKey}
              className="w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3
                bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)]
                hover:opacity-90 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-[var(--lp-accent)] focus:ring-offset-2 focus:ring-offset-[var(--lp-bg)]"
            >
              <AnimatePresence mode="wait">
                {processing ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="h-5 w-5 text-current animate-spin" />
                    <span>Processing...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-5 w-5" />
                    <span>Pay {currency === 'USD' ? '$' : currency === 'NGN' ? '₦' : ''}{amount}</span>
                    <ArrowRight className="h-5 w-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Security badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-4 text-xs lp-secondary"
            >
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span>PCI DSS Level 1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                <span>Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5" />
                <span>Non-custodial</span>
              </div>
            </motion.div>

            {/* Powered by gateway */}
            {session.gateway && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center text-xs lp-muted"
              >
                Powered by <span className="font-medium lp-secondary capitalize">{session.gateway}</span>
              </motion.div>
            )}

          </motion.div>

          {/* Error display */}
          {error && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--lp-border)] bg-[var(--lp-bg)]/50 py-6 px-6">
        <div className="max-w-2xl mx-auto text-center text-xs lp-muted">
          <p>By proceeding, you agree to the merchant's Terms of Service and Privacy Policy.</p>
          <p className="mt-1">Your payment details are processed securely by {session.gateway || 'the payment provider'}. AoraHQ never sees your card details.</p>
        </div>
      </footer>
    </div>
  );
}