import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("EMAT UI crashed:", error, info);
  }

  handleReload = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-slate-600 bg-slate-900 p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">EMAT</p>
          <h1 className="mt-3 text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-400">
            The screen hit an unexpected error. Your data is safe — reload to continue.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
