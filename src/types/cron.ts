export interface CronJobResult {
    success: boolean;
    deletedCount: number;
    message: string;
  }
  
  export interface CronJobError {
    error: string;
    details?: string;
  }