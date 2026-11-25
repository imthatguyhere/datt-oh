import { useInstaller } from "../state/installerStore";

/**
 * Shows the current install/config error as an alert, or nothing when there is none.
 *
 * @returns The error alert, or `null`.
 */
export default function ErrorPanel() {
  const { error } = useInstaller();
  if (!error) return null;

  return (
    <div
      role="alert"
      className="alert alert-error mx-auto mb-4 w-full max-w-6xl shadow-lg shadow-error/20"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="break-all">{error}</span>
    </div>
  );
}
