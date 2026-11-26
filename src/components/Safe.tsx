"use client";
import { Component, type ReactNode } from "react";

// A broken file or a browser without WebGL should show a message in that spot, never take the whole page down.
export default class Safe extends Component<{ children: ReactNode; fallback?: ReactNode; onError?: () => void }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch(e: unknown) { console.warn("3D view failed:", e); this.props.onError?.(); }
  render() { return this.state.bad ? (this.props.fallback === undefined ? <p className="mutedp pad">The 3D preview could not load. Try refreshing the page.</p> : this.props.fallback) : this.props.children; }
}
