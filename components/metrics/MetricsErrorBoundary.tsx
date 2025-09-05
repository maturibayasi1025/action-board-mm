"use client";

import logger from "@/lib/logger";
import React from "react";

interface MetricsErrorBoundaryState {
  hasError: boolean;
}

interface MetricsErrorBoundaryProps {
  children: React.ReactNode;
}

export class MetricsErrorBoundary extends React.Component<
  MetricsErrorBoundaryProps,
  MetricsErrorBoundaryState
> {
  constructor(props: MetricsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): MetricsErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // カスタムロガーでエラーを記録
    logger.logComponentError(error, errorInfo, "MetricsErrorBoundary");

    // 開発環境ではコンソールにも出力
    if (process.env.NODE_ENV === "development") {
      console.error("Metrics component error:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="bg-gradient-hero flex justify-center py-6 px-4">
          <div className="w-full max-w-xl bg-white rounded-md shadow-custom p-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-black mb-2">
                チームみらいの活動状況🚀
              </h2>
              <div role="alert" className="text-red-600 text-sm">
                メトリクスの読み込みに失敗しました
              </div>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
