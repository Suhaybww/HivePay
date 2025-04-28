// src/lib/services/circuitBreaker.ts

/**
 * Options for configuring the CircuitBreaker
 */
interface CircuitBreakerOptions {
    // Number of failures before circuit opens
    failureThreshold: number;
    // Time in milliseconds before circuit attempts to close after opening
    resetTimeout: number;
    // Optional fallback response for when circuit is open
    fallbackResponse?: any;
    // Custom logger function
    logger?: (message: string) => void;
  }
  
  /**
   * Circuit states
   */
  type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  
  /**
   * A circuit breaker implementation to handle external service failures
   * This prevents cascading failures when an external service is down
   */
  export class CircuitBreaker {
    private name: string;
    private state: CircuitState = 'CLOSED';
    private failureCount: number = 0;
    private successCount: number = 0;
    private nextAttempt: number = 0;
    private failureThreshold: number;
    private resetTimeout: number;
    private fallbackResponse: any;
    private logger: (message: string) => void;
    private lastError: Error | null = null;
    private halfOpenSuccessThreshold: number = 2;
  
    /**
     * Creates a new circuit breaker
     * @param name A name to identify this circuit breaker
     * @param options Configuration options
     */
    constructor(name: string, options: CircuitBreakerOptions) {
      this.name = name;
      this.failureThreshold = options.failureThreshold;
      this.resetTimeout = options.resetTimeout;
      this.fallbackResponse = options.fallbackResponse;
      this.logger = options.logger || console.log;
    }
  
    /**
     * Checks if the circuit is currently closed (allowing requests)
     */
    isCircuitClosed(): boolean {
      if (this.state === 'CLOSED') {
        return true;
      }
  
      const now = Date.now();
      
      // If it's open but it's time to retry, move to half-open
      if (this.state === 'OPEN' && now >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        this.logger(`Circuit ${this.name} state changed from OPEN to HALF_OPEN`);
        return true;
      }
  
      return this.state === 'HALF_OPEN';
    }
  
    /**
     * Records a successful operation, potentially closing the circuit
     */
    recordSuccess(): void {
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        
        if (this.successCount >= this.halfOpenSuccessThreshold) {
          this.logger(`Circuit ${this.name} recovered (${this.successCount} successes) - changing to CLOSED`);
          this.closeCircuit();
        }
      } else if (this.state === 'OPEN') {
        // Should not happen normally, but handle just in case
        this.logger(`Unexpected success while circuit ${this.name} is OPEN`);
      } else {
        // Reset failure count on success when closed
        this.failureCount = 0;
      }
    }
  
    /**
     * Records a failed operation, potentially opening the circuit
     * @param error Optional error to store
     */
    recordFailure(error?: Error): void {
      if (error) {
        this.lastError = error;
      }
  
      if (this.state === 'HALF_OPEN') {
        this.logger(`Circuit ${this.name} failed in HALF_OPEN state - reopening circuit`);
        this.openCircuit();
        return;
      }
      
      this.failureCount++;
      this.successCount = 0;
      
      if (this.failureCount >= this.failureThreshold) {
        this.logger(`Circuit ${this.name} failures threshold exceeded (${this.failureCount}/${this.failureThreshold}) - opening circuit`);
        this.openCircuit();
      }
    }
  
    /**
     * Opens the circuit to prevent more requests
     */
    private openCircuit(): void {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.failureCount = 0;
      this.successCount = 0;
    }
  
    /**
     * Closes the circuit to allow requests
     */
    private closeCircuit(): void {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.successCount = 0;
      this.lastError = null;
    }
  
    /**
     * Forces the circuit to close regardless of current state
     * Use this carefully, typically for manual recovery
     */
    forceClose(): void {
      this.logger(`Circuit ${this.name} forced to CLOSED state manually`);
      this.closeCircuit();
    }
  
    /**
     * Gets the current circuit breaker status
     */
    getStatus(): any {
      return {
        name: this.name,
        state: this.state,
        failureCount: this.failureCount,
        successCount: this.successCount,
        nextAttemptTime: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
        lastError: this.lastError ? this.lastError.message : null
      };
    }
  
    /**
     * Executes a function with circuit breaker protection
     * @param fn The function to execute
     * @returns The result of the function or the fallback response
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (!this.isCircuitClosed()) {
        this.logger(`Circuit ${this.name} is OPEN - using fallback response`);
        return this.fallbackResponse as T;
      }
  
      try {
        const result = await fn();
        this.recordSuccess();
        return result;
      } catch (error) {
        this.recordFailure(error instanceof Error ? error : new Error('Unknown error'));
        throw error;
      }
    }
  
    /**
     * Resets the circuit breaker to initial state
     * Useful for testing or after major system changes
     */
    reset(): void {
      this.logger(`Circuit ${this.name} reset to initial state`);
      this.closeCircuit();
    }
  }