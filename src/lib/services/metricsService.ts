// src/lib/services/metricsService.ts

/**
 * A lightweight metrics service that records and reports various system metrics.
 * In a production environment, this would integrate with monitoring systems
 * like CloudWatch, Datadog, Prometheus, etc.
 */
export class MetricsService {
    // Store metrics in memory for immediate access and debugging
    private static metrics: {
      jobMetrics: Map<string, {
        created: number;
        scheduled: number;
        started: number;
        success: number;
        failure: number;
        processingTime: number[];
      }>;
      queueMetrics: Map<string, {
        [key: string]: number;
      }>;
      errors: {
        timestamp: string;
        service: string;
        message: string;
        count: number;
      }[];
      queueHealth: any[];
    } = {
      jobMetrics: new Map(),
      queueMetrics: new Map(),
      errors: [],
      queueHealth: []
    };
  
    // Maximum number of health records to keep
    private static readonly MAX_HEALTH_RECORDS = 100;
    
    // Maximum number of errors to track
    private static readonly MAX_ERROR_RECORDS = 1000;
  
    /**
     * Initialize the metrics service
     */
    static init() {
      console.log('📊 Initializing metrics service');
    }
  
    /**
     * Record when a job is created
     */
    static recordJobCreated(jobType: string): void {
      this.ensureJobMetricsExist(jobType);
      const metrics = this.metrics.jobMetrics.get(jobType)!;
      metrics.created++;
    }
  
    /**
     * Record when a job is scheduled
     */
    static recordJobScheduled(queueName: string, jobType: string): void {
      const key = `${queueName}:${jobType}`;
      this.ensureJobMetricsExist(key);
      const metrics = this.metrics.jobMetrics.get(key)!;
      metrics.scheduled++;
    }
  
    /**
     * Record when a job succeeds
     */
    static recordJobSuccess(queueName: string, jobType: string): void {
      const key = `${queueName}:${jobType}`;
      this.ensureJobMetricsExist(key);
      const metrics = this.metrics.jobMetrics.get(key)!;
      metrics.success++;
    }
  
    /**
     * Record when a job fails
     */
    static recordJobFailure(queueName: string, jobType: string, errorMessage: string): void {
      const key = `${queueName}:${jobType}`;
      this.ensureJobMetricsExist(key);
      const metrics = this.metrics.jobMetrics.get(key)!;
      metrics.failure++;
      
      // Also track the error
      this.recordError(key, errorMessage);
    }
  
    /**
     * Record how long a job took to process
     */
    static recordJobProcessingTime(queueName: string, jobType: string, timeMs: number): void {
      const key = `${queueName}:${jobType}`;
      this.ensureJobMetricsExist(key);
      const metrics = this.metrics.jobMetrics.get(key)!;
      metrics.processingTime.push(timeMs);
      
      // Only keep the last 100 processing times to avoid memory bloat
      if (metrics.processingTime.length > 100) {
        metrics.processingTime.shift();
      }
    }
  
    /**
     * Record a queue event like stalled, cleaned, etc.
     */
    static recordQueueEvent(queueName: string, eventType: string, count: number = 1): void {
      if (!this.metrics.queueMetrics.has(queueName)) {
        this.metrics.queueMetrics.set(queueName, {});
      }
      
      const queueMetrics = this.metrics.queueMetrics.get(queueName)!;
      queueMetrics[eventType] = (queueMetrics[eventType] || 0) + count;
    }
  
    /**
     * Record a critical error
     */
    static recordCriticalError(service: string, message: string): void {
      console.error(`CRITICAL ERROR [${service}]: ${message}`);
      
      // In a real implementation, this would send an alert to a monitoring system
      this.recordError(service, message, true);
    }
  
    /**
     * Record an error
     */
    private static recordError(service: string, message: string, isCritical: boolean = false): void {
      // Check if we have a similar error already
      const existingError = this.metrics.errors.find(e => 
        e.service === service && e.message === message
      );
      
      if (existingError) {
        existingError.count++;
        existingError.timestamp = new Date().toISOString();
      } else {
        // Add new error
        this.metrics.errors.push({
          timestamp: new Date().toISOString(),
          service,
          message,
          count: 1
        });
        
        // Limit the number of errors we track
        if (this.metrics.errors.length > this.MAX_ERROR_RECORDS) {
          this.metrics.errors.shift();
        }
      }
      
      // If this is critical, we would send an alert in a real implementation
      if (isCritical) {
        // In production, send to alert system, pager duty, etc.
      }
    }
  
    /**
     * Record overall queue health metrics
     */
    static recordQueueHealth(healthData: any): void {
      // Add timestamp
      const enrichedData = {
        ...healthData,
        timestamp: new Date().toISOString()
      };
      
      // Add to health records
      this.metrics.queueHealth.push(enrichedData);
      
      // Limit the number of health records we keep
      if (this.metrics.queueHealth.length > this.MAX_HEALTH_RECORDS) {
        this.metrics.queueHealth.shift();
      }
      
      // In a real implementation, this would send metrics to a monitoring system
      // e.g., CloudWatch, Datadog, Prometheus, etc.
    }
  
    /**
     * Get job metrics for a specific job type
     */
    static getJobMetrics(jobType?: string): any {
      if (jobType) {
        return this.metrics.jobMetrics.get(jobType) || {
          created: 0,
          scheduled: 0,
          started: 0,
          success: 0,
          failure: 0,
          processingTime: []
        };
      }
      
      // Return all job metrics
      return Array.from(this.metrics.jobMetrics.entries()).map(([key, metrics]) => {
        const avgProcessingTime = metrics.processingTime.length > 0
          ? metrics.processingTime.reduce((a, b) => a + b, 0) / metrics.processingTime.length
          : 0;
          
        return {
          jobType: key,
          created: metrics.created,
          scheduled: metrics.scheduled,
          success: metrics.success,
          failure: metrics.failure,
          successRate: metrics.success + metrics.failure > 0
            ? (metrics.success / (metrics.success + metrics.failure)) * 100
            : 0,
          avgProcessingTime: Math.round(avgProcessingTime),
          totalJobs: metrics.success + metrics.failure
        };
      });
    }
  
    /**
     * Get queue metrics
     */
    static getQueueMetrics(queueName?: string): any {
      if (queueName) {
        return this.metrics.queueMetrics.get(queueName) || {};
      }
      
      // Return all queue metrics
      return Array.from(this.metrics.queueMetrics.entries()).map(([key, metrics]) => ({
        queueName: key,
        ...metrics
      }));
    }
  
    /**
     * Get recent errors
     */
    static getErrors(limit: number = 10): any[] {
      return this.metrics.errors
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    }
  
    /**
     * Get queue health history
     */
    static getQueueHealthHistory(limit: number = 10): any[] {
      return this.metrics.queueHealth
        .slice(-limit)
        .reverse();
    }
  
    /**
     * Get a summary of all metrics
     */
    static getMetricsSummary(): any {
      const jobMetrics = this.getJobMetrics();
      const queueMetrics = this.getQueueMetrics();
      const recentErrors = this.getErrors(5);
      const queueHealth = this.getQueueHealthHistory(1)[0] || {};
      
      const totalJobs = jobMetrics.reduce((sum: number, job: any) => sum + job.totalJobs, 0);
      const totalSuccess = jobMetrics.reduce((sum: number, job: any) => sum + job.success, 0);
      const totalFailures = jobMetrics.reduce((sum: number, job: any) => sum + job.failure, 0);
      
      return {
        summary: {
          totalJobs,
          totalSuccess,
          totalFailures,
          overallSuccessRate: totalJobs > 0 ? (totalSuccess / totalJobs) * 100 : 0,
          jobTypes: jobMetrics.length,
          queues: queueMetrics.length,
          recentErrors: recentErrors.length,
          isHealthy: queueHealth.isHealthy || false
        },
        topJobsByVolume: jobMetrics
          .sort((a: any, b: any) => b.totalJobs - a.totalJobs)
          .slice(0, 3),
        topJobsByFailureRate: jobMetrics
          .filter((job: any) => job.totalJobs > 5) // Only consider jobs with meaningful sample size
          .sort((a: any, b: any) => 
            (b.failure / (b.success + b.failure)) - 
            (a.failure / (a.success + a.failure))
          )
          .slice(0, 3),
        recentErrors,
        currentQueueHealth: queueHealth
      };
    }
  
    /**
     * Reset all metrics (mainly for testing)
     */
    static resetMetrics(): void {
      this.metrics.jobMetrics.clear();
      this.metrics.queueMetrics.clear();
      this.metrics.errors = [];
      this.metrics.queueHealth = [];
    }
  
    /**
     * Create job metrics entry if it doesn't exist
     */
    private static ensureJobMetricsExist(jobType: string): void {
      if (!this.metrics.jobMetrics.has(jobType)) {
        this.metrics.jobMetrics.set(jobType, {
          created: 0,
          scheduled: 0,
          started: 0,
          success: 0,
          failure: 0,
          processingTime: []
        });
      }
    }
  }
  
  // Initialize metrics service
  MetricsService.init();