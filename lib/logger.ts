interface ErrorContext {
  userId?: string;
  pathname?: string;
  method?: string;
  statusCode?: number;
  [key: string]: unknown;
}

interface ErrorLogEntry {
  timestamp: string;
  message: string;
  stack?: string;
  context?: ErrorContext;
  digest?: string;
  level: "error" | "warn" | "info";
  environment: string;
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  async log(
    error: Error | string,
    context?: ErrorContext,
    level: "error" | "warn" | "info" = "error",
  ): Promise<void> {
    const errorMessage = typeof error === "string" ? error : error.message;
    const errorStack = typeof error === "object" ? error.stack : undefined;
    const errorDigest =
      typeof error === "object"
        ? (error as { digest?: string }).digest
        : undefined;

    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      message: errorMessage,
      stack: errorStack,
      context,
      digest: errorDigest,
      level,
      environment: process.env.NODE_ENV || "development",
    };

    // 開発環境ではコンソールに出力
    if (this.isDevelopment) {
      console.error("[ErrorLogger]", logEntry);
      return;
    }

    // 本番環境では外部サービスに送信
    if (this.isProduction) {
      try {
        // エラーログAPIに送信（将来的にCloudWatch, Datadog等に送信）
        await this.sendToLogService(logEntry);
      } catch (sendError) {
        // ログ送信に失敗してもアプリケーションは継続
        console.error("[ErrorLogger] Failed to send log:", sendError);
      }
    }
  }

  private async sendToLogService(logEntry: ErrorLogEntry): Promise<void> {
    // 現在はコンソールに出力（後でCloudWatch/Datadog等に置き換え）
    console.error("[Production Error]", JSON.stringify(logEntry));

    // 将来的な実装例:
    // await fetch("/api/logs", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(logEntry),
    // });
  }

  // React Error Boundary用のヘルパー
  logComponentError(
    error: Error,
    errorInfo: React.ErrorInfo,
    componentName?: string,
  ): void {
    this.log(error, {
      componentName,
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
  }

  // Next.js Server Actions用のヘルパー
  async logServerActionError(
    error: Error,
    action: string,
    params?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(error, {
      action,
      params: params ? JSON.stringify(params) : undefined,
      type: "server-action",
    });
  }

  // API Route用のヘルパー
  async logApiError(
    error: Error,
    request: Request,
    pathname: string,
    userId?: string,
  ): Promise<void> {
    await this.log(error, {
      pathname,
      method: request.method,
      url: request.url,
      userId,
      type: "api-route",
    });
  }
}

export const logger = ErrorLogger.getInstance();
export default logger;
