"use client";

import { Component, type ReactNode } from "react";
import { AppErrorView } from "./app-error-view";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return <AppErrorView error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
