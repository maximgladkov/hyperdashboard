export default function Toast({ message, isError, hidden }: { message: string; isError: boolean; hidden: boolean }) {
  if (hidden) return null;
  return (
    <div id="toast" className={isError ? "err" : ""}>
      <span className="dot"></span>
      <span>{message}</span>
    </div>
  );
}
