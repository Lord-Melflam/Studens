/**
 * What the product shows when something throws.
 *
 * WITHOUT THIS, THE ANSWER IS A BLANK PAGE. React 18 unmounts the whole tree
 * when a render or an effect throws, so a single mistake anywhere below the
 * root leaves an empty document and a line in a console nobody has open. That
 * is what François saw on 2026-09-13, and the worst part was not the bug: it
 * was that the screen said nothing at all, so there was no way to tell a broken
 * build from a slow one from a wrong URL.
 *
 * It is deliberately plain and self-contained. It loads no strings, because a
 * failure in the translator is one of the things it has to survive, and it uses
 * inline styles, because a stylesheet that did not load is another.
 *
 * The message is shown to whoever is looking, including in production. There is
 * no user data in a stack trace from this application, and hiding the reason
 * from the person best placed to report it buys nothing.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Still logged, because the stack in the console is far more useful than
    // the message on screen when somebody is actually debugging.
    console.error("Studens: unhandled error", error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main
        style={{
          maxWidth: "34rem",
          margin: "0 auto",
          padding: "3rem 1.25rem",
          font: "16px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#16191d",
        }}
      >
        {/*
          NOT TRANSLATED, on purpose, and the one screen in the product that is
          not. A failure inside the translator or its bundle is exactly one of
          the things this has to survive, so it cannot call it. Three languages
          in one paragraph says the same thing to everyone without depending on
          anything.
        */}
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.6rem" }}>
          Something broke · Er ging iets mis · Quelque chose a cassé
        </h1>
        <p style={{ color: "#5b6470", margin: "0 0 1.25rem" }}>
          This page could not be displayed. Reload it; if it happens again, the message below
          is what to send us.
        </p>
        <pre
          style={{
            padding: "0.8rem",
            fontSize: "0.8rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#f4f5f7",
            border: "1px solid #dfe3e8",
            borderRadius: "7px",
          }}
        >
          {error.name}: {error.message}
        </pre>
        <p style={{ marginTop: "1.25rem" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.6rem 1.2rem",
              font: "inherit",
              fontWeight: 600,
              color: "#fff",
              background: "#1b4a8f",
              border: "1px solid #1b4a8f",
              borderRadius: "7px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>{" "}
          <a href="/" style={{ marginLeft: "0.6rem", color: "#1b4a8f" }}>
            Home
          </a>
        </p>
      </main>
    );
  }
}
