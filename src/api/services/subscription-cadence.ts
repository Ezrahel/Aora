// ============================================================
// AoraHQ Subscription Cadence Service
// Handles subscription date calculations, state transitions, and lifecycle
// ============================================================

/**
 * Billing interval types supported by AoraHQ
 */
export type BillingInterval = 'weekly' | 'monthly' | 'yearly' | 'quarterly';

/**
 * Plan interface reflecting the database schema
 */
export interface Plan {
  id: string;
  tenantId: string;
  productId: string;
  name: string;
  description: string;
  amount: bigint;                    // Amount in lowest denomination (cents/kobo)
  currency: string;                  // ISO 4217 currency code
  interval: BillingInterval;         // 'weekly' | 'monthly' | 'yearly' | 'quarterly'
  intervalCount: number;             // e.g., 1 for monthly, 3 for quarterly
  trialDays: number;
  isArchived: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subscription status types
 */
export type SubscriptionStatus = 
  | 'active' 
  | 'trial' 
  | 'past_due' 
  | 'canceled' 
  | 'paused' 
  | 'unpaid';

/**
 * Tenant interface
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: 'active' | 'suspended' | 'deleted';
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subscription interface reflecting the database schema
 */
export interface Subscription {
  id: string;
  tenantId: string;
  customerId: string;
  planId: string;
  tenantGatewayId: string;
  
  // Non-custodial tokens
  gatewayCustomerToken: string;
  gatewayPaymentToken: string;
  
  // Status and dates
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd: Date | null;
  canceledAt: Date | null;
  pausedAt: Date | null;
  pauseResumesAt: Date | null;
  cancelAtPeriodEnd: boolean;
  
  // Billing metadata
  seatQuantity: number;
  quantity: number;
  metadata: Record<string, unknown>;
  
  // Gateway sync
  gatewaySubscriptionId: string | null;
  gatewayCustomerId: string | null;
  gatewayStatus: string | null;
  lastSyncedAt: Date | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of subscription operations
 */
export interface SubscriptionResult {
  subscription: Subscription;
  previousStatus?: SubscriptionStatus;
  message?: string;
}

/**
 * Error class for cadence service operations
 */
export class CadenceServiceError extends Error {
  public readonly code: string;
  public readonly recoverable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    recoverable: boolean = false,
    originalError?: Error
  ) {
    super(message);
    this.name = 'CadenceServiceError';
    this.code = code;
    this.recoverable = recoverable;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CadenceServiceError);
    }
  }

  static fromError(err: unknown, context: string): CadenceServiceError {
    if (err instanceof CadenceServiceError) return err;
    const message = err instanceof Error ? err.message : String(err);
    return new CadenceServiceError(
      `${context}: ${message}`,
      'CADENCE_SERVICE_ERROR',
      false,
      err instanceof Error ? err : undefined
    );
  }
}

/**
 * Date Calculation Engine
 * Handles all subscription date arithmetic with proper edge case handling
 */
export class DateCalculator {
  /**
   * Calculate the next billing date based on interval
   * Handles edge cases: month overflow, leap years, year boundaries
   * 
   * @param startDate - The date to calculate from (UTC)
   * @param interval - Billing interval
   * @param intervalCount - Number of intervals to add (default 1)
   * @returns New Date in UTC
   */
  static calculateNextBillingDate(
    startDate: Date,
    interval: BillingInterval,
    intervalCount: number = 1
  ): Date {
    if (intervalCount <= 0) {
      throw new CadenceServiceError(
        'intervalCount must be positive',
        'INVALID_INTERVAL_COUNT'
      );
    }

    let result = new Date(startDate);
    
    switch (interval) {
      case 'weekly':
        // Weekly: add 7 days * intervalCount
        result.setDate(result.getUTCDate() + 7 * intervalCount);
        break;
        
      case 'monthly':
        result = this.addMonths(result, intervalCount);
        break;
        
      case 'quarterly':
        result = this.addMonths(result, 3 * intervalCount);
        break;
        
      case 'yearly':
        result = this.addYears(result, intervalCount);
        break;
        
      default:
        throw new CadenceServiceError(
          `Unknown billing interval: ${interval}`,
          'INVALID_INTERVAL'
        );
    }
    
    return result;
  }

  /**
   * Safely add months to a date, handling month overflow
   * Jan 31 + 1 month = Feb 28 (or 29 in leap year)
   * Aug 31 + 1 month = Sep 30
   * 
   * @param date - Source date (not mutated)
   * @param months - Number of months to add
   * @returns New Date in UTC
   */
  static addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const targetMonth = result.getUTCMonth() + months;
    const targetYear = result.getUTCFullYear() + Math.floor(targetMonth / 12);
    const finalMonth = targetMonth % 12;
    
    // Get the last day of the target month
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, finalMonth + 1, 0)
    ).getUTCDate();
    
    // Use the minimum of current day and last day of target month
    const currentDay = result.getUTCDate();
    const targetDay = Math.min(currentDay, lastDayOfTargetMonth);
    
    // IMPORTANT: Set date to 1 FIRST to avoid overflow when changing months
    // e.g., Jan 31 + 1 month would overflow to March 2/3 if we change month first
    result.setUTCDate(1);
    result.setUTCFullYear(targetYear);
    result.setUTCMonth(finalMonth);
    result.setUTCDate(targetDay);
    
    return result;
  }

  /**
   * Safely add years to a date
   * Handles Feb 29 leap year transitions
   * Feb 29, 2024 + 1 year = Feb 28, 2025
   * Feb 29, 2020 + 4 years = Feb 29, 2024
   * 
   * @param date - Source date (not mutated)
   * @param years - Number of years to add
   * @returns New Date in UTC
   */
  static addYears(date: Date, years: number): Date {
    const result = new Date(date);
    const targetYear = result.getUTCFullYear() + years;
    const currentMonth = result.getUTCMonth();
    const currentDay = result.getUTCDate();
    
    // Check if we're on Feb 29
    const isFeb29 = currentMonth === 1 && currentDay === 29;
    
    if (isFeb29) {
      // Check if target year is a leap year
      const isTargetLeapYear = this.isLeapYear(targetYear);
      if (!isTargetLeapYear) {
        // Move to Feb 28
        result.setUTCFullYear(targetYear);
        result.setUTCMonth(1); // February
        result.setUTCDate(28);
        return result;
      }
    }
    
    result.setUTCFullYear(targetYear);
    return result;
  }

  /**
   * Check if a year is a leap year
   */
  static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * Calculate the number of days in a month for a given year
   */
  static daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }

  /**
   * Calculate the end of trial period
   * Trial ends at 23:59:59 UTC on the trial end date
   * 
   * @param trialStart - When trial starts (usually now)
   * @param trialDays - Number of trial days
   * @returns Trial end date (end of day UTC)
   */
  static calculateTrialEnd(trialStart: Date, trialDays: number): Date {
    if (trialDays <= 0) {
      return new Date(trialStart);
    }
    const end = new Date(trialStart);
    end.setUTCDate(end.getUTCDate() + trialDays);
    // Set to end of day
    end.setUTCHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Check if a date is in the past (relative to now)
   */
  static isPast(date: Date): boolean {
    return date.getTime() < Date.now();
  }

  /**
   * Check if a subscription period is ending soon (within grace period)
   */
  static isPeriodEndingSoon(periodEnd: Date, gracePeriodDays: number = 3): boolean {
    const now = new Date();
    const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
    return periodEnd.getTime() - now.getTime() <= gracePeriodMs && periodEnd > now;
  }

  /**
   * Calculate days until period end
   */
  static daysUntilPeriodEnd(periodEnd: Date): number {
    const now = new Date();
    const diffMs = periodEnd.getTime() - now.getTime();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  }

  /**
   * Create a new UTC date at start of day (00:00:00.000)
   */
  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Create a new UTC date at end of day (23:59:59.999)
   */
  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }
}

/**
 * Subscription Cadence Service
 * Manages subscription lifecycle, renewals, and state transitions
 */
export class SubscriptionCadenceService {
  private query: typeof import("../db/pool.ts").query;
  private withTransaction: typeof import("../db/pool.ts").withTransaction;

  constructor(
    queryFn: typeof import("../db/pool.ts").query,
    transactionFn: typeof import("../db/pool.ts").withTransaction
  ) {
    this.query = queryFn;
    this.withTransaction = transactionFn;
  }

  /**
   * Create a new subscription with proper date initialization
   * 
   * @param tenantId - Tenant ID
   * @param customerId - Customer ID
   * @param planId - Plan ID
   * @param tenantGatewayId - Gateway connection ID
   * @param gatewayCustomerToken - Gateway customer token
   * @param gatewayPaymentToken - Gateway payment method token
   * @param trialDays - Override trial days (optional, uses plan default if not provided)
   * @param seatQuantity - Number of seats
   * @param quantity - Quantity multiplier
   * @param metadata - Additional metadata
   * @returns Created subscription
   */
  async createSubscription(params: {
    tenantId: string;
    customerId: string;
    planId: string;
    tenantGatewayId: string;
    gatewayCustomerToken: string;
    gatewayPaymentToken: string;
    trialDays?: number;
    seatQuantity?: number;
    quantity?: number;
    metadata?: Record<string, unknown>;
  }): Promise<SubscriptionResult> {
    // Fetch plan details
    const plan = await this.fetchPlan(params.planId);
    if (!plan) {
      throw new CadenceServiceError('Plan not found', 'PLAN_NOT_FOUND');
    }
    if (plan.isArchived) {
      throw new CadenceServiceError('Plan is archived', 'PLAN_ARCHIVED');
    }

    // Verify customer exists and belongs to tenant
    const customer = await this.fetchCustomer(params.customerId);
    if (!customer) {
      throw new CadenceServiceError('Customer not found', 'CUSTOMER_NOT_FOUND');
    }
    if (customer.tenantId !== params.tenantId) {
      throw new CadenceServiceError('Customer does not belong to tenant', 'TENANT_MISMATCH');
    }

    // Check for existing active subscription
    const existing = await this.findActiveSubscription(params.customerId);
    if (existing) {
      throw new CadenceServiceError(
        'Customer already has an active subscription',
        'ACTIVE_SUBSCRIPTION_EXISTS'
      );
    }

    // Calculate dates
    const now = new Date();
    const periodStart = DateCalculator.startOfDay(now);
    const periodEnd = DateCalculator.calculateNextBillingDate(
      now,
      plan.interval,
      plan.intervalCount
    );

    // Calculate trial end if applicable
    const trialDays = params.trialDays ?? plan.trialDays;
    const trialEnd = trialDays > 0 
      ? DateCalculator.calculateTrialEnd(now, trialDays)
      : null;

    const initialStatus = trialDays > 0 ? 'trial' : 'active';

    const subscriptionId = `sub_${this.generateId()}`;
    const subscriptionIdShort = `sub_${this.generateId()}`;

    await this.withTransaction(async (client: any) => {
      // Create subscription
      await client.query(`
        INSERT INTO subscriptions (
          id, tenant_id, customer_id, plan_id, tenant_gateway_id,
          gateway_customer_token, gateway_payment_token,
          status, current_period_start, current_period_end,
          trial_end, seat_quantity, quantity, metadata,
          cancel_at_period_end, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now())
      `, [
        subscriptionIdShort,
        params.tenantId,
        params.customerId,
        params.planId,
        params.tenantGatewayId,
        params.gatewayCustomerToken,
        params.gatewayPaymentToken,
        initialStatus,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        trialEnd?.toISOString() ?? null,
        params.seatQuantity ?? 1,
        params.quantity ?? 1,
        JSON.stringify(params.metadata ?? {}),
        false,
      ]);

      // Create initial invoice for the first period (if not trial)
      if (initialStatus === 'active') {
        await this.createInvoice(client, {
          tenantId: params.tenantId,
          customerId: params.customerId,
          planId: params.planId,
          subscriptionId: subscriptionIdShort,
          amount: plan.amount,
          currency: plan.currency,
          periodStart,
          periodEnd,
          description: `${plan.name} subscription`,
        });
      }

      // Create audit log
      await client.query(`
        INSERT INTO audit_logs (
          workspace_id, actor, action, entity_type, entity_id, 
          before_state, after_state, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `, [
        params.tenantId,
        'System',
        'CREATE',
        'SUBSCRIPTION',
        subscriptionIdShort,
        null,
        JSON.stringify({
          planId: params.planId,
          status: initialStatus,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        }),
      ]);
    });

    // Fetch and return the created subscription
    const subscription = await this.fetchSubscription(subscriptionIdShort);
    if (!subscription) {
      throw new CadenceServiceError('Failed to retrieve created subscription', 'CREATION_FAILED');
    }

    return {
      subscription,
      message: `Subscription created with ${initialStatus} status`,
    };
  }

  /**
   * Renew a subscription - advance to next billing period
   * Uses the current period end as the new period start (no drift)
   * 
   * @param subscriptionId - Subscription to renew
   * @param paymentResult - Optional payment result from gateway
   * @returns Updated subscription
   */
  async renewSubscription(
    subscriptionId: string,
    paymentResult?: { transactionId: string; gatewayPaymentIntentId?: string }
  ): Promise<SubscriptionResult> {
    return this.withTransaction(async (client: any) => {
      // Fetch current subscription
      const subscription = await this.fetchSubscriptionForRenewal(client, subscriptionId);
      if (!subscription) {
        throw new CadenceServiceError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
      }

      // Fetch plan details
      const plan = await this.fetchPlan(subscription.planId);
      if (!plan) {
        throw new CadenceServiceError('Plan not found', 'PLAN_NOT_FOUND');
      }

      // Verify subscription is eligible for renewal
      if (subscription.status === 'canceled') {
        throw new CadenceServiceError(
          'Cannot renew canceled subscription',
          'SUBSCRIPTION_CANCELED'
        );
      }
      if (subscription.status === 'paused') {
        throw new CadenceServiceError(
          'Cannot renew paused subscription',
          'SUBSCRIPTION_PAUSED'
        );
      }

      // Calculate new period dates
      // IMPORTANT: Use currentPeriodEnd as the new periodStart to prevent drift
      const newPeriodStart = subscription.currentPeriodEnd;
      const newPeriodEnd = DateCalculator.calculateNextBillingDate(
        subscription.currentPeriodEnd,
        plan.interval,
        plan.intervalCount
      );

      // Update subscription
      const updates: string[] = [
        'current_period_start = $2',
        'current_period_end = $3',
        'status = \'active\'',
        'updated_at = now()',
      ];
      const params = [subscription.id, newPeriodStart.toISOString(), newPeriodEnd.toISOString()];

      if (paymentResult?.transactionId) {
        params.push(paymentResult.transactionId);
      }

      await client.query(
        `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = $1`,
        params
      );

      // Create renewal invoice
      const amount = plan.amount * BigInt(subscription.quantity) * BigInt(subscription.seatQuantity);
      await this.createInvoice(client, {
        tenantId: subscription.tenantId,
        customerId: subscription.customerId,
        planId: subscription.planId,
        subscriptionId: subscription.id,
        amount: plan.amount * BigInt(subscription.quantity) * BigInt(subscription.seatQuantity),
        currency: plan.currency,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
        description: `${plan.name} subscription renewal`,
        gatewayTransactionId: paymentResult?.transactionId,
      });

      // Create audit log
      await client.query(`
        INSERT INTO audit_logs (
          workspace_id, actor, action, entity_type, entity_id,
          before_state, after_state, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `, [
        subscription.tenantId,
        'System',
        'RENEW',
        'SUBSCRIPTION',
        subscription.id,
        JSON.stringify({
          status: 'active',
          periodStart: subscription.currentPeriodStart.toISOString(),
          periodEnd: subscription.currentPeriodEnd.toISOString(),
        }),
        JSON.stringify({
          status: 'active',
          periodStart: newPeriodStart.toISOString(),
          periodEnd: newPeriodEnd.toISOString(),
        }),
      ]);

      // Fetch and return updated subscription
      const updated = await this.fetchSubscription(subscription.id);
      if (!updated) {
        throw new CadenceServiceError('Failed to retrieve renewed subscription', 'RENEWAL_FAILED');
      }

      return {
        subscription: updated,
        message: 'Subscription renewed successfully',
      };
    });
  }

  /**
   * Handle failed payment - transition to past_due or unpaid
   * 
   * @param subscriptionId - Subscription with failed payment
   * @param error - Error details from payment gateway
   * @param attemptCount - Number of retry attempts
   * @returns Updated subscription
   */
  async handleFailedPayment(params: {
    subscriptionId: string;
    error: { code: string; message: string; recoverable: boolean };
    attemptCount?: number;
  }): Promise<SubscriptionResult> {
    return this.withTransaction(async (client: any) => {
      const subscription = await this.fetchSubscriptionForRenewal(client, params.subscriptionId);
      if (!subscription) {
        throw new CadenceServiceError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
      }

      // Determine new status based on error recoverability and attempt count
      const attemptCount = params.attemptCount ?? 1;
      const maxRetries = 3; // Configurable

      let newStatus: SubscriptionStatus = 'past_due';
      let isRecoverable = params.error.recoverable;

      if (!params.error.recoverable || attemptCount >= maxRetries) {
        newStatus = 'unpaid';
        isRecoverable = false;
      }

      // Update subscription
      await client.query(`
        UPDATE subscriptions 
        SET status = $2, 
            metadata = metadata || jsonb_build_object(
              'last_payment_error', jsonb_build_object(
                'code', $2,
                'message', $3,
                'recoverable', $4,
                'attempt', $5,
                'at', now()
              )
            ),
            updated_at = now()
        WHERE id = $1
      `, [
        params.subscriptionId,
        newStatus,
        params.error.code,
        params.error.message,
        isRecoverable,
        attemptCount,
      ]);

      // Create audit log
      await client.query(`
        INSERT INTO audit_logs (
          workspace_id, actor, action, entity_type, entity_id,
          before_state, after_state, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `, [
        'unknown', // tenantId would need to be fetched
        'System',
        'PAYMENT_FAILED',
        'SUBSCRIPTION',
        params.subscriptionId,
        JSON.stringify({ status: 'active' }),
        JSON.stringify({ 
          status: newStatus, 
          error: params.error,
          attempt: attemptCount 
        }),
      ]);

      // Create past_due invoice if transitioning to past_due
      if (newStatus === 'past_due') {
        // Fetch subscription again for details
        const sub = await this.fetchSubscription(params.subscriptionId);
        if (sub) {
          const plan = await this.fetchPlan(sub.planId);
          if (plan) {
            await this.createInvoice(client, {
              tenantId: sub.tenantId,
              customerId: sub.customerId,
              planId: sub.planId,
              subscriptionId: sub.id,
              amount: plan.amount * BigInt(sub.quantity) * BigInt(sub.seatQuantity),
              currency: plan.currency,
              periodStart: sub.currentPeriodStart,
              periodEnd: sub.currentPeriodEnd,
              description: `Failed payment for ${plan.name}`,
              metadata: { failedPayment: true, error: params.error },
            });
          }
        }
      }

      // Fetch and return updated subscription
      const updated = await this.fetchSubscription(params.subscriptionId);
      if (!updated) {
        throw new CadenceServiceError('Failed to retrieve updated subscription', 'UPDATE_FAILED');
      }

      return {
        subscription: updated,
        previousStatus: subscription.status,
        message: `Payment failed - subscription marked as ${newStatus}`,
      };
    });
  }

  /**
   * Cancel a subscription (at period end or immediately)
   */
  async cancelSubscription(params: {
    subscriptionId: string;
    immediately?: boolean;
    reason?: string;
  }): Promise<SubscriptionResult> {
    return this.withTransaction(async (client: any) => {
      const subscription = await this.fetchSubscriptionForRenewal(client, params.subscriptionId);
      if (!subscription) {
        throw new CadenceServiceError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
      }

      if (subscription.status === 'canceled') {
        throw new CadenceServiceError('Subscription already canceled', 'ALREADY_CANCELED');
      }

      const now = new Date();
      let newStatus: SubscriptionStatus;
      let newPeriodEnd: Date | null = null;

      if (params.immediately) {
        newStatus = 'canceled';
        // Period ends now for immediate cancellation
      } else {
        newStatus = 'active'; // Remains active until period end
        // cancel_at_period_end = true
        await client.query(`
          UPDATE subscriptions 
          SET cancel_at_period_end = true, updated_at = now()
          WHERE id = $1
        `, [params.subscriptionId]);
        return {
          subscription: { ...subscription, cancelAtPeriodEnd: true },
          previousStatus: subscription.status,
          message: 'Subscription will cancel at period end',
        };
      }

      await client.query(`
        UPDATE subscriptions 
        SET status = $2, canceled_at = $3, updated_at = now()
        WHERE id = $1
      `, [params.subscriptionId, newStatus, now.toISOString()]);

      // Create audit log
      await client.query(`
        INSERT INTO audit_logs (
          workspace_id, actor, action, entity_type, entity_id,
          before_state, after_state, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `, [
        'unknown',
        'System',
        'CANCEL',
        'SUBSCRIPTION',
        params.subscriptionId,
        JSON.stringify({ status: subscription.status }),
        JSON.stringify({ status: newStatus, reason: params.reason }),
      ]);

      const updated = await this.fetchSubscription(params.subscriptionId);
      if (!updated) {
        throw new CadenceServiceError('Failed to retrieve canceled subscription', 'CANCEL_FAILED');
      }

      return {
        subscription: updated,
        previousStatus: subscription.status,
        message: `Subscription canceled ${params.immediately ? 'immediately' : 'at period end'}`,
      };
    });
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    return this.withTransaction(async (client: any) => {
      const subscription = await this.fetchSubscriptionForRenewal(client, subscriptionId);
      if (!subscription) {
        throw new CadenceServiceError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
      }

      if (subscription.status !== 'active') {
        throw new CadenceServiceError(
          `Cannot pause subscription with status '${subscription.status}'`,
          'INVALID_STATUS_FOR_PAUSE'
        );
      }

      const now = new Date();
      await client.query(`
        UPDATE subscriptions 
        SET status = 'paused', paused_at = $2, updated_at = now()
        WHERE id = $1
      `, [subscriptionId, now.toISOString()]);

      // Create audit log
      await client.query(`
        INSERT INTO audit_logs (
          workspace_id, actor, action, entity_type, entity_id,
          before_state, after_state, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `, [
        'unknown',
        'System',
        'PAUSE',
        'SUBSCRIPTION',
        subscriptionId,
        JSON.stringify({ status: 'active' }),
        JSON.stringify({ status: 'paused' }),
      ]);

      const updated = await this.fetchSubscription(subscriptionId);
      if (!updated) {
        throw new CadenceServiceError('Failed to retrieve paused subscription', 'PAUSE_FAILED');
      }

      return {
        subscription: updated,
        previousStatus: 'active',
        message: 'Subscription paused successfully',
      };
    });
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    return this.withTransaction(async (client: any) => {
      const subscription = await this.fetchSubscriptionForRenewal(client, subscriptionId);
      if (!subscription) {
        throw new CadenceServiceError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
      }

      if (subscription.status !== 'paused') {
        throw new CadenceServiceError(
          `Cannot resume subscription with status '${subscription.status}'`,
          'INVALID_STATUS_FOR_RESUME'
        );
      }

      const now = new Date();
      const periodEnd = DateCalculator.calculateNextBillingDate(
        subscription.currentPeriodEnd,
        'monthly', // Will be replaced with actual plan interval
        1
      );

      await client.query(`
        UPDATE subscriptions 
        SET status = 'active', paused_at = null, 
            current_period_start = $2, current_period_end = $3,
            updated_at = now()
        WHERE id = $1
      `, [subscriptionId, now.toISOString(), periodEnd.toISOString()]);

      // Create audit log
      await client.query(`
        INSERT INTO audit_logs (
          workspace_id, actor, action, entity_type, entity_id,
          before_state, after_state, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `, [
        'unknown',
        'System',
        'RESUME',
        'SUBSCRIPTION',
        subscriptionId,
        JSON.stringify({ status: 'paused' }),
        JSON.stringify({ status: 'active' }),
      ]);

      const updated = await this.fetchSubscription(subscriptionId);
      if (!updated) {
        throw new CadenceServiceError('Failed to retrieve resumed subscription', 'RESUME_FAILED');
      }

      return {
        subscription: updated,
        previousStatus: 'paused',
        message: 'Subscription resumed successfully',
      };
    });
  }

  // ============================================================
  // Private helper methods
  // ============================================================

  private async fetchPlan(planId: string): Promise<Plan | null> {
    const { rows } = await this.query(
      `SELECT id, tenant_id, product_id, name, description, amount, currency,
              interval, interval_count, trial_days, is_archived, metadata,
              created_at, updated_at
       FROM plans WHERE id = $1`,
      [planId]
    );
    return rows[0] ?? null;
  }

  private async fetchCustomer(customerId: string): Promise<{ id: string; tenantId: string } | null> {
    const { rows } = await this.query(
      `SELECT id, tenant_id FROM customers WHERE id = $1 AND is_deleted = false`,
      [customerId]
    );
    return rows[0] ?? null;
  }

  private async fetchSubscription(subscriptionId: string): Promise<Subscription | null> {
    const { rows } = await this.query(
      `SELECT 
        id, tenant_id, customer_id, plan_id, tenant_gateway_id,
        gateway_customer_token, gateway_payment_token,
        status, current_period_start, current_period_end,
        trial_end, canceled_at, paused_at, pause_resumes_at,
        cancel_at_period_end, seat_quantity, quantity, metadata,
        gateway_subscription_id, gateway_customer_id, gateway_status,
        last_synced_at, created_at, updated_at
       FROM subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    if (rows.length === 0) return null;
    return this.mapSubscriptionRow(rows[0]);
  }

  private async fetchSubscriptionForRenewal(
    client: any, 
    subscriptionId: string
  ): Promise<Subscription | null> {
    const { rows } = await client.query(
      `SELECT 
        id, tenant_id, customer_id, plan_id, tenant_gateway_id,
        gateway_customer_token, gateway_payment_token,
        status, current_period_start, current_period_end,
        trial_end, canceled_at, paused_at, pause_resumes_at,
        cancel_at_period_end, seat_quantity, quantity, metadata,
        gateway_subscription_id, gateway_customer_id, gateway_status,
        last_synced_at
       FROM subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    if (rows.length === 0) return null;
    return this.mapSubscriptionRow(rows[0]);
  }

  private async findActiveSubscription(customerId: string): Promise<Subscription | null> {
    const { rows } = await this.query(
      `SELECT 
        id, tenant_id, customer_id, plan_id, tenant_gateway_id,
        gateway_customer_token, gateway_payment_token,
        status, current_period_start, current_period_end,
        trial_end, canceled_at, paused_at, pause_resumes_at,
        cancel_at_period_end, seat_quantity, quantity, metadata,
        gateway_subscription_id, gateway_customer_id, gateway_status,
        last_synced_at, created_at, updated_at
       FROM subscriptions 
       WHERE customer_id = $1 AND status IN ('active', 'trial')
       ORDER BY created_at DESC LIMIT 1`,
      [customerId]
    );
    if (rows.length === 0) return null;
    return this.mapSubscriptionRow(rows[0]);
  }

  private mapSubscriptionRow(row: any): Subscription {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      planId: row.plan_id,
      tenantGatewayId: row.tenant_gateway_id,
      gatewayCustomerToken: row.gateway_customer_token,
      gatewayPaymentToken: row.gateway_payment_token,
      status: row.status,
      currentPeriodStart: new Date(row.current_period_start),
      currentPeriodEnd: new Date(row.current_period_end),
      trialEnd: row.trial_end ? new Date(row.trial_end) : null,
      canceledAt: row.canceled_at ? new Date(row.canceled_at) : null,
      pausedAt: row.paused_at ? new Date(row.paused_at) : null,
      pauseResumesAt: row.pause_resumes_at ? new Date(row.pause_resumes_at) : null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      seatQuantity: row.seat_quantity,
      quantity: row.quantity,
      metadata: row.metadata ?? {},
      gatewaySubscriptionId: row.gateway_subscription_id,
      gatewayCustomerId: row.gateway_customer_id,
      gatewayStatus: row.gateway_status,
      lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async createInvoice(client: any, params: {
    tenantId: string;
    customerId: string;
    planId: string;
    subscriptionId: string;
    amount: bigint;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    description: string;
    gatewayTransactionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const { rows } = await client.query(`
      INSERT INTO invoices (
        tenant_id, customer_id, subscription_id, plan_id,
        amount, currency, status, description,
        period_start, period_end, due_at,
        line_items, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'open',
        $7, $8, $9, $10,
        $11, $12, now())
      RETURNING id
    `, [
      params.tenantId,
      params.customerId,
      params.subscriptionId,
      params.planId,
      params.amount,
      params.currency,
      params.description,
      params.periodStart.toISOString(),
      params.periodEnd.toISOString(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 7 days
      JSON.stringify([{
        description: params.description,
        quantity: 1,
        unitAmount: params.amount,
        amount: params.amount,
        type: 'base_fee',
      }]),
      JSON.stringify(params.metadata ?? {}),
    ]);

    return rows[0].id;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
}