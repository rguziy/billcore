"use client";

import { useEffect, useRef } from "react";

interface Props {
  title: string;
  show: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmVariant?: string;
  children: React.ReactNode;
}

export default function Modal({
  title, show, onClose, onConfirm, confirmLabel = "Save", confirmVariant = "primary", children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("bootstrap").then(({ Modal }) => {
      const el = ref.current;
      if (!el) return;
      const modal = Modal.getOrCreateInstance(el);
      show ? modal.show() : modal.hide();
    });
  }, [show]);

  return (
    <div className="modal fade" ref={ref} tabIndex={-1}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
          {onConfirm && (
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className={`btn btn-${confirmVariant}`} onClick={onConfirm}>{confirmLabel}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
