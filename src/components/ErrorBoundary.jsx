import { Component } from "react";

const initialState = { error: null, info: null };

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = initialState;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Log to console in dev, could send to an error service in prod
    console.error("[ErrorBoundary] Caught:", error, info);
  }

  componentDidMount() {
    // Auto-retry once after 1.5s for transient loading failures
    this._autoRetry = setTimeout(() => {
      if (this.state.error) this.setState(initialState);
    }, 1500);
  }

  componentWillUnmount() {
    clearTimeout(this._autoRetry);
  }

  handleRetry = () => {
    this.setState(initialState);
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClearSW = async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      // Allow custom fallback via props
      if (this.props.fallback) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback({
              error: this.state.error,
              retry: this.handleRetry,
              reload: this.handleReload,
              clearSW: this.handleClearSW,
            })
          : this.props.fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
            fontFamily: "Inter, system-ui, sans-serif",
            textAlign: "center",
            background: "#fdfcfa",
            color: "#17172f",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "#fff5e9",
              padding: "5px",
              marginBottom: "16px",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280", maxWidth: "360px", margin: "0 0 24px", lineHeight: 1.5 }}>
            FamOS hit a snag while loading this page. Your data is safe.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "10px 20px",
                borderRadius: "999px",
                border: "none",
                background: "#17172f",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 20px",
                borderRadius: "999px",
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#17172f",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
            <button
              onClick={this.handleClearSW}
              style={{
                padding: "10px 20px",
                borderRadius: "999px",
                border: "1px solid #fde7d6",
                background: "#fffbf5",
                color: "#c26a1b",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear cache & reload
            </button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <details style={{ marginTop: "20px", maxWidth: "500px", textAlign: "left", fontSize: "11px", color: "#9ca3af" }}>
              <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Error details</summary>
              <pre style={{ marginTop: "8px", padding: "8px", background: "#f3f4f6", borderRadius: "8px", overflow: "auto", whiteSpace: "pre-wrap" }}>
                {this.state.error?.toString()}
              </pre>
              <pre style={{ marginTop: "4px", padding: "8px", background: "#f3f4f6", borderRadius: "8px", overflow: "auto", whiteSpace: "pre-wrap", fontSize: "10px" }}>
                {this.state.info?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
