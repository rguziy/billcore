"use client";

interface Props {
  message: string | null;
  variant?: string;
  onClose: () => void;
}

export default function Alert({ message, variant = "danger", onClose }: Props) {
  if (!message) return null;
  return (
    <div className={`alert alert-${variant} alert-dismissible`} role="alert">
      {message}
      <button type="button" className="btn-close" onClick={onClose} />
    </div>
  );
}
