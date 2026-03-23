// src/shared/components/ErrorBoundary.tsx
// الوظيفة: حاجز أخطاء لكل وحدة رئيسية — يعرض رسالة عربية مع زر إعادة تحميل
// يُغلّف كل صفحة/وحدة لمنع انهيار التطبيق بالكامل

'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.moduleName ? ` — ${this.props.moduleName}` : ''}]:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            حدث خطأ غير متوقع
          </h3>
          <p className="text-sm text-gray-500 mb-1 max-w-md">
            {this.props.moduleName
              ? `حدث خطأ في وحدة "${this.props.moduleName}". حاول تحديث الصفحة.`
              : 'حدث خطأ أثناء تحميل هذا القسم. حاول تحديث الصفحة.'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <p className="text-xs text-red-400 font-mono mt-2 max-w-lg break-all bg-red-50 p-2 rounded-lg">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3 mt-6">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200
                text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المحاولة
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-bunyan-600 hover:bg-bunyan-700
                text-white rounded-xl text-sm font-medium transition-colors"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
