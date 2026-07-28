"use client";

export default function WorkspaceError(props: { unstable_retry: () => void }) {
  return (
    <section className="empty-panel">
      <h2>We couldn&apos;t load your workspace</h2>
      <p>Your data is still safe. Check your connection and try again.</p>
      <button
        className="button app-primary"
        onClick={props.unstable_retry}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
